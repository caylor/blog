---
title: "React源码解析 3 —— setState与事务机制"
date: "2018-05-15"
tags: 
    - React
---

了解了React组件整个生命周期之后呢，我们来看一下之前一直提到的setState更新及事务机制。

<!-- excerpt_end -->

## 1.setState

```javascript
function ReactComponent(props, context, updater) {
  // ...
  this.updater = updater || ReactNoopUpdateQueue;
}

ReactComponent.prototype.setState = function (partialState, callback) {
  this.updater.enqueueSetState(this, partialState);
  if (callback) {
    this.updater.enqueueCallback(this, callback, 'setState');
  }
};
```

`setState`接受两个参数，需更新的`partialState`和更新后要执行的回调`callback`。方法里我们看到分别调用的是`this.updater`的`enqueueSetState`和`enqueueCallback`方法。而组件的`updater`具体是什么呢，我们回顾下之前自定义组件的渲染。

```javascript
mountComponent: function (transaction, hostParent, hostContainerInfo, context) {
  // ...
  var updateQueue = transaction.getUpdateQueue();
  var inst = this._constructComponent(doConstruct, publicProps, publicContext, updateQueue);

  // These should be set up in the constructor, but as a convenience for
  // simpler class abstractions, we set them up after the fact.
  inst.props = publicProps;
  inst.context = publicContext;
  inst.refs = emptyObject;
  inst.updater = updateQueue;

  ReactInstanceMap.set(inst, this);
  // ...
}

_constructComponent: function (doConstruct, publicProps, publicContext, updateQueue) {
  return this._constructComponentWithoutOwner(doConstruct, publicProps, publicContext, updateQueue);
}

_constructComponentWithoutOwner: function (doConstruct, publicProps, publicContext, updateQueue) {
  // ...
  return new Component(publicProps, publicContext, updateQueue);
}
```

这里就很明了了，`updater`就是`updateQueue`。知道了`updater`后，我们接着来看看他的`enqueueSetState`方法。

ReactUpdateQueue.js
```javascript
enqueueSetState: function (publicInstance, partialState) {
  var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'setState');

  if (!internalInstance) {
    return;
  }

  var queue = internalInstance._pendingStateQueue || (internalInstance._pendingStateQueue = []);
  queue.push(partialState);

  enqueueUpdate(internalInstance);
}
```

首先`getInternalInstanceReadyForUpdate`获取到组件对象（`mountComponent`时会将组件存在`ReactInstanceMap`中），然后将待更新state添加到组件的更新队列`_pendingStateQueue`（更新队列不存在则创建），最后`enqueueUpdate`实现更新。

ReactUpdates.js
```javascript
function enqueueUpdate(component) {
  if (!batchingStrategy.isBatchingUpdates) {
    batchingStrategy.batchedUpdates(enqueueUpdate, component);
    return;
  }

  dirtyComponents.push(component);
}
```

如果`isBatchingUpdates`为`true`，即组件正在创建或者更新中，则将`component`放入`dirtyComponents`中后续处理，否则执行`batchedUpdates`以事务方式更新组件。这里值得提一下的是，在组件创建时也会调用`batchedUpdates`。

ReactDefaultBatchingStrategy.js
```javascript
var RESET_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: function () {
    ReactDefaultBatchingStrategy.isBatchingUpdates = false;
  }
};

var FLUSH_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)
};

var ReactDefaultBatchingStrategy = {
  isBatchingUpdates: false,

  batchedUpdates: function (callback, a, b, c, d, e) {
    var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;

    ReactDefaultBatchingStrategy.isBatchingUpdates = true;

    if (alreadyBatchingUpdates) {
      return callback(a, b, c, d, e);
    } else {
      return transaction.perform(callback, null, a, b, c, d, e);
    }
  }
};
```

更新时首先会将`isBatchingUpdates`置为`true`，即已进入更新阶段，然后以事务方式更新组件，事务中会先调用`ReactUpdates.flushBatchedUpdates`，方法中会遍历`dirtyComponents`，执行组件的`updateComponent`，并执行它的`pendingCallbacks`，事务结束时调用`RESET_BATCHED_UPDATES.close`，此时会将`isBatchingUpdates`置为`false`，结束更新。

## 2.事务机制

先来看下源码解析图：

Transaction.js
```javascript
/**
 * ...
 * <pre>
 *                       wrappers (injected at creation time)
 *                                      +        +
 *                                      |        |
 *                    +-----------------|--------|--------------+
 *                    |                 v        |              |
 *                    |      +---------------+   |              |
 *                    |   +--|    wrapper1   |---|----+         |
 *                    |   |  +---------------+   v    |         |
 *                    |   |          +-------------+  |         |
 *                    |   |     +----|   wrapper2  |--------+   |
 *                    |   |     |    +-------------+  |     |   |
 *                    |   |     |                     |     |   |
 *                    |   v     v                     v     v   | wrapper
 *                    | +---+ +---+   +---------+   +---+ +---+ | invariants
 * perform(anyMethod) | |   | |   |   |         |   |   | |   | | maintained
 * +----------------->|-|---|-|---|-->|anyMethod|---|---|-|---|-|-------->
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | +---+ +---+   +---------+   +---+ +---+ |
 *                    |  initialize                    close    |
 *                    +-----------------------------------------+
 * </pre>
 * ...
 */
```

这张图形象地解释了React中的事务Transaction。Transaction就像创建了一个黑盒，对外暴露了一个接口`perform`，同时内部给方法包装了一个或多个`wrapper`，`wrapper`则只需实现两个方法，`initialize`和`close`。当执行方法时，需调用接口`perform`，`perform`会首先执行`wrapper`的`initialize`，然后执行函数本身，最后执行`wrapper`的`close`。我们来具体看下代码实现。  

```javascript
var TransactionImpl = {
  reinitializeTransaction: function () {
    this.transactionWrappers = this.getTransactionWrappers();
    if (this.wrapperInitData) {
      this.wrapperInitData.length = 0;
    } else {
      this.wrapperInitData = [];
    }
    this._isInTransaction = false;
  },

  _isInTransaction: false,

  //抽象方法，实现时需返回wrappers数组
  getTransactionWrappers: null,

  isInTransaction: function () {
    return !!this._isInTransaction;
  },

  perform: function (method, scope, a, b, c, d, e, f) {
    var errorThrown;
    var ret;
    try {
      this._isInTransaction = true;
      // 异常标识，如果捕获异常的话会使调试比较困难，所以开始时设置标识为true。如果最终errorThrown仍为true，说明方法调用抛出异常
      errorThrown = true;
      // 逐个调用wrappers中的initialize方法
      this.initializeAll(0);
      ret = method.call(scope, a, b, c, d, e, f);
      errorThrown = false;
    } finally {
      try {
        // 最后执行wrappers中的close方法
        if (errorThrown) {
          try {
            this.closeAll(0);
          } catch (err) {}
        } else {
          this.closeAll(0);
        }
      } finally {
        this._isInTransaction = false;
      }
    }
    return ret;
  },

  initializeAll: function (startIndex) {
    var transactionWrappers = this.transactionWrappers;
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i];
      try {
        // 异常处理设计方式同perform中
        this.wrapperInitData[i] = OBSERVED_ERROR;
        // 执行wrapper的initialize
        this.wrapperInitData[i] = wrapper.initialize ? wrapper.initialize.call(this) : null;
      } finally {
        if (this.wrapperInitData[i] === OBSERVED_ERROR) {
          // 如果当前wrapper抛出异常，则继续执行剩余wrapper的initialize。但是如果再抛出异常，则捕获且不做处理，以确保最终冒泡出去的是第一次捕获到的异常。
          try {
            this.initializeAll(i + 1);
          } catch (err) {}
        }
      }
    }
  },

  closeAll: function (startIndex) {
    var transactionWrappers = this.transactionWrappers;
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i];
      var initData = this.wrapperInitData[i];
      var errorThrown;
      try {
        errorThrown = true;
        // 如果当前wrapper实现了close方法且之前对应的initialize执行成功，则执行close方法
        if (initData !== OBSERVED_ERROR && wrapper.close) {
          wrapper.close.call(this, initData);
        }
        errorThrown = false;
      } finally {
        if (errorThrown) {
          try {
            this.closeAll(i + 1);
          } catch (e) {}
        }
      }
    }
    this.wrapperInitData.length = 0;
  }
};
```

那么不同的`Transaction`如何定义，`wrappers`又是如何注入的呢，我们以上面`ReactDefaultBatchingStrategy`中的事务为例，看下具体实现。

```javascript
var RESET_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: function () {
    ReactDefaultBatchingStrategy.isBatchingUpdates = false;
  }
};

var FLUSH_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)
};

var TRANSACTION_WRAPPERS = [FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES];

function ReactDefaultBatchingStrategyTransaction() {
  this.reinitializeTransaction();
}

_assign(ReactDefaultBatchingStrategyTransaction.prototype, Transaction, {
  getTransactionWrappers: function () {
    return TRANSACTION_WRAPPERS;
  }
});

var transaction = new ReactDefaultBatchingStrategyTransaction();
```

`ReactDefaultBatchingStrategyTransaction`定义时在原型链上扩展了`Transaction`，重写了`getTransactionWrappers`原型方法用来返回wrappers，最终实例化时在构造函数中调用`reinitializeTransaction`实现注入。可以看到wrappers是一个数组，包含`FLUSH_BATCHED_UPDATES`和`RESET_BATCHED_UPDATES`两个wrapper，且每个都实现了`initialize`和`close`方法。

## 3.总结

setState的总体流程：  
1. `enqueueSetState`将待更新state放入更新队列，执行`enqueueUpdate`。  
2. 如果当前正在更新组件，则将组件存入`dirtyComponent`，否则执行`batchedUpdates`。  
3. `batchedUpdates`发起事务，遍历`dirtyComponents`，调用`updateComponent`更新组件，执行`pendingCallbacks`。