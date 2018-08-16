---
title: "React源码阅读 5 —— 对象池及React diff"
date: "2018-07-09"
tags: 
    - React
---

React合成事件是一个跨浏览器原生事件包装器，具有与浏览器原生事件相同的接口。

<!-- excerpt_end -->

## 1.对象池

我们在阅读合成事件、事务等时经常看到`getPooled`的操作，这就是我们要接下来要看的对象池。
我们知道对象的创建及销毁会销毁性能，若在短时间内大量地创建新对象又释放，则会导致内存抖动，引起频繁GC，从而性能降低，影响用户体验。
为了避免内存抖动，React的解决方案是使用对象池，将实例对象使用后重置属性然后存起来以便复用。

PooledClass.js

```javascript
var oneArgumentPooler = function (copyFieldsFrom) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, copyFieldsFrom);
    return instance;
  } else {
    return new Klass(copyFieldsFrom);
  }
};

var standardReleaser = function (instance) {
  var Klass = this;
  instance.destructor();
  if (Klass.instancePool.length < Klass.poolSize) {
    Klass.instancePool.push(instance);
  }
};

var DEFAULT_POOL_SIZE = 10;
var DEFAULT_POOLER = oneArgumentPooler;

var addPoolingTo = function (CopyConstructor, pooler) {
  var NewKlass = CopyConstructor;
  NewKlass.instancePool = [];
  NewKlass.getPooled = pooler || DEFAULT_POOLER;
  if (!NewKlass.poolSize) {
    NewKlass.poolSize = DEFAULT_POOL_SIZE;
  }
  NewKlass.release = standardReleaser;
  return NewKlass;
};

var PooledClass = {
  addPoolingTo: addPoolingTo,
  oneArgumentPooler: oneArgumentPooler,
  // ...
};
```

对象池的整体实现：  
1. 通过调用`addPoolingTo`给目标构造函数注册对象池`instancePool`。
2. `getPooled`方法访问当前对象池，若存在可用对象则从队列尾取出复用，否则创建新对象。
3. `release`方法中调用对象实例的原型对象上的`destructor`重置对象属性，若对象池还有空间，则存入对象池。

## 2.React diff

对于树的diff，通常会循环递归对节点依次对比，如果树的节点过多，会非常消耗性能，如果是在页面渲染的场景中则会出现页面卡顿。那么该如何优化改进呢，React采取了制定相应的策略做法：

1. DOM节点跨层级移动的操作较少，忽略不计
2. 只有同一类的组件实例才会生成相同的树形结构
3. 同一层级的子节点都打唯一标识

可以看出，这是一种非全量diff，策略忽略了场景中的极少数情况来提高整体性能。对于前两个策略对应的 tree diff 和 component diff，若判断类型、type等不一致，则会直接移除组件重新挂载。下面我们具体来看下 element diff 的具体操作。

```javascript
_updateChildren: function (nextNestedChildrenElements, transaction, context) {
  var prevChildren = this._renderedChildren;
  var removedNodes = {};
  var mountImages = [];
  var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);
  if (!nextChildren && !prevChildren) {
    return;
  }
  var updates = null;
  var name;
  // `nextIndex`为遍历`nextChildren`时的当前遍历索引
  // `lastIndex`为访问过的`prevChildren`中节点的最大索引（遍历`nextChildren`时会访问`prevChildren`中存在的相同节点）
  var nextIndex = 0;
  var lastIndex = 0;
  // `nextMountIndex` will increment for each newly mounted child.
  var nextMountIndex = 0;
  var lastPlacedNode = null;
  for (name in nextChildren) {
    if (!nextChildren.hasOwnProperty(name)) {
      continue;
    }
    var prevChild = prevChildren && prevChildren[name];
    var nextChild = nextChildren[name];
    if (prevChild === nextChild) {  // `prevChildren`中存在相同节点
      // 判断新旧集合中相同节点的位置，进行移动操作
      updates = enqueue(updates, this.moveChild(prevChild, lastPlacedNode, nextIndex, lastIndex));
      // 更新lastIndex
      lastIndex = Math.max(prevChild._mountIndex, lastIndex);
      prevChild._mountIndex = nextIndex;
    } else {
      if (prevChild) {
        lastIndex = Math.max(prevChild._mountIndex, lastIndex);
      }
      // 插入新节点
      updates = enqueue(updates, this._mountChildAtIndex(nextChild, mountImages[nextMountIndex], lastPlacedNode, nextIndex, transaction, context));
      nextMountIndex++;
    }
    nextIndex++;
    lastPlacedNode = ReactReconciler.getHostNode(nextChild);
  }
  // 删除旧集合中的多余节点
  for (name in removedNodes) {
    if (removedNodes.hasOwnProperty(name)) {
      updates = enqueue(updates, this._unmountChild(prevChildren[name], removedNodes[name]));
    }
  }
  if (updates) {
    processQueue(this, updates);
  }
  this._renderedChildren = nextChildren;
},

moveChild: function (child, afterNode, toIndex, lastIndex) {
  // 如果新集合中的节点索引小于旧集合中相同节点的索引，则移动。
  // 反之，说明当前处于与旧集合相同的节点顺序，无须操作
  if (child._mountIndex < lastIndex) {
    return makeMove(child, afterNode, toIndex);
  }
},
```

这是一种基于渲染前后节点顺序的操作优化。主要逻辑为：  
遍历即将渲染的集合，根据节点`key`去寻找之前集合中的相同节点，同时用`lastIndex`标识访问过的旧集合中节点的最大索引，每次访问都进行更新。  
若存在相同节点，则对比旧集合中节点的位置，若相比旧集合节点在其之后，则说明与旧集合顺序一致，不需要进行操作，否则则移动。  
若不存在相同节点，则新插入当前节点。  
新集合遍历结束后，删除之前的多余节点。