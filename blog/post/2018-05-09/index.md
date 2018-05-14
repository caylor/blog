---
title: "React源码解析 2 —— 组件生命周期详解"
date: "2018-05-09"
tags: 
    - React
---

我们已经了解了React组件的创建和挂载，接下来我们研究下组件的生命周期。

<!-- excerpt_end -->

整个生命周期分为三个不同阶段，实例化、存在期和销毁。

## 1.实例化

`componentWillMount`，`render`，`componentDidMount`都是在`mountComponent`中调用。

ReactCompositeComponent.js
```javascript
mountComponent: function (transaction, hostParent, hostContainerInfo, context) {
  // ...
  var markup;
  if (inst.unstable_handleError) {
    markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);
  } else {
    markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);
  }

  if (inst.componentDidMount) {
    transaction.getReactMountReady().enqueue(inst.componentDidMount, inst);
  }

  return markup;
}
```

`performInitialMount`中具体实现挂载（`performInitialMountWithErrorHandling`只多一层错误处理），完成后以事务的方式调用`componentDidMount`。我们再看下`performInitialMount`。

```javascript
performInitialMount: function (renderedElement, hostParent, hostContainerInfo, transaction, context) {
  var inst = this._instance;

  if (inst.componentWillMount) {
    inst.componentWillMount();

    if (this._pendingStateQueue) {
      inst.state = this._processPendingState(inst.props, inst.context);
    }
  }

  if (renderedElement === undefined) {
    renderedElement = this._renderValidatedComponent();
  }

  var nodeType = ReactNodeTypes.getType(renderedElement);
  this._renderedNodeType = nodeType;
  var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY);
  var markup = ReactReconciler.mountComponent(child, transaction, hostParent, hostContainerInfo, this._processChildContext(context), debugID);
  return markup;
}
```

`performInitialMount`中先调用`componentWillMount`，然后进行state合并（也就意味着`componentWillMount`中调用`setState`不会触发重新`render`），接着调用`_renderValidatedComponent`（最终调用`inst.render`）获得`ReactElement`，进一步由`_instantiateReactComponent`创建`ReactComponent`，最后递归渲染。

## 2.存在期

组件挂载后，我们可以通过`setState`来更新。它会调用`updateComponent`完成更新。

```javascript
updateComponent: function (transaction, prevParentElement, nextParentElement, prevUnmaskedContext, nextUnmaskedContext) {
  var inst = this._instance;
  // ...
  
  if (willReceive && inst.componentWillReceiveProps) {
    inst.componentWillReceiveProps(nextProps, nextContext);
  }

  var nextState = this._processPendingState(nextProps, nextContext);
  var shouldUpdate = true;

  if (!this._pendingForceUpdate) {
    if (inst.shouldComponentUpdate) {
      shouldUpdate = inst.shouldComponentUpdate(nextProps, nextState, nextContext);
    } else {
      if (this._compositeType === CompositeTypes.PureClass) {
        shouldUpdate = !shallowEqual(prevProps, nextProps) || !shallowEqual(inst.state, nextState);
      }
    }
  }

  if (shouldUpdate) {
    this._pendingForceUpdate = false;
    this._performComponentUpdate(nextParentElement, nextProps, nextState, nextContext, transaction, nextUnmaskedContext);
  } else {
    this._currentElement = nextParentElement;
    this._context = nextUnmaskedContext;
    inst.props = nextProps;
    inst.state = nextState;
    inst.context = nextContext;
  }
}
```

`updateComponent`中调用逻辑：
1. 调用`componentWillReceiveProps`。
2. 合并 state。
3. 判断`shouldUpdate`，如果组件实例对象声明了`shouldComponentUpdate`，则调用，否则如果是`PureComponent`，则对 props 和 state 浅比较判断。
4. 调用`_performComponentUpdate`进行组件更新。

```javascript
_performComponentUpdate: function (nextElement, nextProps, nextState, nextContext, transaction, unmaskedContext) {
  var inst = this._instance;
  // ...
  
  if (inst.componentWillUpdate) {
    inst.componentWillUpdate(nextProps, nextState, nextContext);
  }
  //...

  this._updateRenderedComponent(transaction, unmaskedContext);

  if (hasComponentDidUpdate) {
    transaction.getReactMountReady().enqueue(inst.componentDidUpdate.bind(inst, prevProps, prevState, prevContext), inst);
  }
}
```

`_performComponentUpdate`先调用`componentWillUpdate`，然后调用`_updateRenderedComponent`更新组件渲染，最后调用`componentDidUpdate`。

```javascript
_updateRenderedComponent: function (transaction, context) {
  var prevComponentInstance = this._renderedComponent;
  var prevRenderedElement = prevComponentInstance._currentElement;
  var nextRenderedElement = this._renderValidatedComponent();

  if (shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {
    ReactReconciler.receiveComponent(prevComponentInstance, nextRenderedElement, transaction, this._processChildContext(context));
  } else {
    var oldHostNode = ReactReconciler.getHostNode(prevComponentInstance);
    ReactReconciler.unmountComponent(prevComponentInstance, false);

    var nodeType = ReactNodeTypes.getType(nextRenderedElement);
    var child = this._instantiateReactComponent(nextRenderedElement, nodeType !== ReactNodeTypes.EMPTY
    );
    var nextMarkup = ReactReconciler.mountComponent(child, transaction, this._hostParent, this._hostContainerInfo, this._processChildContext(context), debugID);
    this._replaceNodeWithMarkup(oldHostNode, nextMarkup, prevComponentInstance);
  }
}
```

`_updateRenderedComponent`中的`shouldUpdateReactComponent`我们在看组件的渲染时也提到了，为避免DOM diff更新判断过程中循环递归对比节点，React只对层级不变，type不变，key不变的组件进行Virtual DOM更新。这里呢，如果需要更新，则`ReactReconciler.receiveComponent`递归更新子组件，否则`unmountComponent`卸载组件重新挂载渲染。

## 3.销毁

```javascript
unmountComponent: function (safely) {
  if (!this._renderedComponent) {
    return;
  }

  var inst = this._instance;

  if (inst.componentWillUnmount && !inst._calledComponentWillUnmount) {
    inst._calledComponentWillUnmount = true;

    if (safely) {
      var name = this.getName() + '.componentWillUnmount()';
      ReactErrorUtils.invokeGuardedCallback(name, inst.componentWillUnmount.bind(inst));
    } else {
      inst.componentWillUnmount();
    }
  }

  if (this._renderedComponent) {
    ReactReconciler.unmountComponent(this._renderedComponent, safely);
    this._renderedNodeType = null;
    this._renderedComponent = null;
    this._instance = null;
  }
  // ...
}
```

`unmountComponent`就是调用`componentWillUnmount`，`unmountComponent`递归卸载子组件，最后置空内部变量。

## 4.总结

我们了解了生命周期的三个阶段及钩子函数的触发，这里就贴下源码里的注释总结。

```javascript
/**
 * ------------------ The Life-Cycle of a Composite Component ------------------
 *
 * - constructor: Initialization of state. The instance is now retained.
 *   - componentWillMount
 *   - render
 *   - [children's constructors]
 *     - [children's componentWillMount and render]
 *     - [children's componentDidMount]
 *     - componentDidMount
 *
 *       Update Phases:
 *       - componentWillReceiveProps (only called if parent updated)
 *       - shouldComponentUpdate
 *         - componentWillUpdate
 *           - render
 *           - [children's constructors or receive props phases]
 *         - componentDidUpdate
 *
 *     - componentWillUnmount
 *     - [children's componentWillUnmount]
 *   - [children destroyed]
 * - (destroyed): The instance is now blank, released by React and ready for GC.
 *
 * -----------------------------------------------------------------------------
 */
```
