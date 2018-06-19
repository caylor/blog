---
title: "React源码解析 1 —— 组件的创建及渲染"
date: "2018-04-29"
tags: 
    - React
---

组件使你可以将 UI 划分为一个一个独立、可复用的小部件，并可以对每个部件进行单独的设计。

<!-- excerpt_end -->

## 1.前言
1. 默认大家对React的常用api比较熟悉。
2. 阅读版本为 v15.4.1。
3. 理解解析若有误，还望指出讨论。

## 2.组件

当我们使用ES6写React的时候，`class A extends React.Component`信手拈来，那么`React.Component`到底是什么，我们来看一下

```javascript
var React = {
  // Modern
  Component: ReactBaseClasses.Component,
  PureComponent: ReactBaseClasses.PureComponent,
  createElement: createElement,

  // Classic
  PropTypes: ReactPropTypes,
  createClass: createReactClass,
  //...
};
```

ReactBaseClasses.js
```javascript
function ReactComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}

ReactComponent.prototype.isReactComponent = {};

ReactComponent.prototype.setState = function (partialState, callback) {
  //...
};

ReactComponent.prototype.forceUpdate = function (callback) {
  //...
};
```

我们可以看到`React.Component`就是一个基类，有props、refs和setState等我们常用的属性及方法。
除了`React.Component`，我们发现还有一个`React.PureComponent`，两者的区别就是在组件更新的时候，如果组件内没有定义`shouldComponentUpdate`钩子函数时，`PureComponent`会对state进行浅比较决定是否更新。

```javascript
updateComponent: function (transaction, prevParentElement, nextParentElement, prevUnmaskedContext, nextUnmaskedContext) {
  // ...
  if (!this._pendingForceUpdate) {
      if (inst.shouldComponentUpdate) {
        // ...
      } else {
        if (this._compositeType === CompositeTypes.PureClass) {
          shouldUpdate = !shallowEqual(prevProps, nextProps) || !shallowEqual(inst.state, nextState);
        }
      }
    }
}
```

如果不用ES6 class声明，我们可以用`React.createClass`创建，只是其中需要用`getInitialState`等特定api，其他实现几乎一样。

## 3.React元素

ReactElement.js
```javascript
var ReactElement = function (type, key, ref, self, source, owner, props) {
  var element = {
    $$typeof: REACT_ELEMENT_TYPE,

    type: type,
    key: key,
    ref: ref,
    props: props,
  };
  // ...
  return element;
}

ReactElement.createElement = function (type, config, children) {
  // ...
  return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
};
```

数据类，JSX元素语法糖及我们通过`class`声明的React组件的`render`方法实际调用的就是`createElement`，最终返回一个`ReactElement`对象。

## 4.元素的渲染

我们都知道`ReactDOM.render`方法将React元素渲染到参数提供的DOM中，如果先前已经被渲染了，那么将对其更新。接下来我们就来深入了解下整个过程。

### 创建组件
`ReactDOM.render`是`ReactMount.render`的引用，进一步调用`_renderSubtreeIntoContainer`方法。

ReactMount.js
```javascript
_renderSubtreeIntoContainer: function (parentComponent, nextElement, container, callback) {
  // ...
  // 获取当前容器下已存在组件
  var prevComponent = getTopLevelWrapperInContainer(container);

  if (prevComponent) {
    //是否更新组件
    if (shouldUpdateReactComponent(prevElement, nextElement)) {
      ReactMount._updateRootComponent(prevComponent, nextWrappedElement, nextContext, container, updatedCallback);
      return publicInst;
    } else {
      // 卸载组件
      ReactMount.unmountComponentAtNode(container);
    }
  }
  // ...
  var component = ReactMount._renderNewRootComponent(nextWrappedElement, container, shouldReuseMarkup, nextContext)._renderedComponent.getPublicInstance();
  return component;
}

render: function (nextElement, container, callback) {
  return ReactMount._renderSubtreeIntoContainer(null, nextElement, container, callback);
}
```

方法首先判断了接下来要进行的是渲染还是更新，简单看一下判断逻辑：
1. `getTopLevelWrapperInContainer`获取当前容器下已存在组件`prevComponent`。
2. 若`prevComponent`存在，且`shouldUpdateReactComponent`（对存在的element和待渲染的element的数据类型及type、key属性值进行比较判断），则调用`_updateRootComponent`更新组件，否则最终执行`_renderNewRootComponent`渲染元素。

接着，我们来看下`_renderNewRootComponent`方法。  

```javascript
_renderNewRootComponent: function (nextElement, container, shouldReuseMarkup, context) {
  // ...
  var componentInstance = instantiateReactComponent(nextElement, false);
  ReactUpdates.batchedUpdates(batchedMountComponentIntoNode, componentInstance, container, shouldReuseMarkup, context);
  return componentInstance;
}
```

我们可以看到组件就是在这里创建：
1. `instantiateReactComponent`创建组件。
2. `ReactUpdates.batchedUpdates`判断异步渲染时是否有组件更新，根据当前策略做对应处理（是否已事务的形式执行`batchedMountComponentIntoNode`）。

重点来看下`instantiateReactComponent`方法。

instantiateReactComponent.js
```javascript
function instantiateReactComponent(node, shouldHaveDebugID) {
  if (node === null || node === false) {
    instance = ReactEmptyComponent.create(instantiateReactComponent);
  } else if (typeof node === 'object') {
    if (typeof element.type === 'string') {
      instance = ReactHostComponent.createInternalComponent(element);
    } else if (isInternalComponentType(element.type)) {
      instance = new element.type(element);
    } else {
      instance = new ReactCompositeComponentWrapper(element);
    }
  } else if (typeof node === 'string' || typeof node === 'number') {
    instance = ReactHostComponent.createInstanceForText(node);
  }
  return instance;
}
```

方法根据传入的`node`的数据类型返回不同类型的组件，大致有ReactDOMEmptyComponent、ReactCompositeComponent、ReactDOMComponent、ReactDOMTextComponent类型等。其中`ReactCompositeComponent`是我们比较常用的组件，其具有完整生命周期的钩子，后面我们会单独讲解。

最后`batchedMountComponentIntoNode`则以事务形式调用`mountComponentIntoNode`方法进行后续渲染。

### 解析组件插入DOM

`mountComponentIntoNode`方法中主要就是解析组件。

```javascript
function mountComponentIntoNode(wrapperInstance, container, transaction, shouldReuseMarkup, context) {
  // ...
  var markup = ReactReconciler.mountComponent(wrapperInstance, transaction, null, ReactDOMContainerInfo(wrapperInstance, container), context, 0);
  ReactMount._mountImageIntoNode(markup, container, wrapperInstance, shouldReuseMarkup, transaction);
}
```

我们之前看到`instantiateReactComponent`会获取到不同的组件类型，而且他们对`mountComponent`方法有不同的实现。`ReactReconciler.mountComponent`就是调用第一个参数`wrapperInstance`的`mountComponent`方法解析出Html结构记为`markup`，然后调用`_mountImageIntoNode`插入到DOM中。

```javascript
_mountImageIntoNode: function (markup, container, instance, shouldReuseMarkup, transaction) {
  // ...
  setInnerHTML(container, markup);
  ReactDOMComponentTree.precacheNode(instance, container.firstChild);
  // ...
}
```
