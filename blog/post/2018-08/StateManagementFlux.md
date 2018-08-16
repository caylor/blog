---
title: "React状态管理 —— Flux篇"
date: "2018-08-07"
tags: 
    - React
    - Flux
---

Flux是Facebook推出的一种构建用户界面的架构，采用单向数据流模式。

<!-- excerpt_end -->

这种模式下组件不会改变接收的数据，只监听数据的变化来触发更新。

### 数据流

```javascript
/**
 *                                        +--------+
 *                          +------------ | Action |<----------+
 *                          |             +--------+           |
 *                          v                                  |
 *    +--------+      +------------+      +--------+      +--------+
 *    | Action |----->| Dispatcher |----->|  Store |----->|  View  |
 *    +--------+      +------------+      +--------+      +--------+
 * 
 */
```

Flux应用主要包含三部分：Dispatcher、Store和View。整个数据流中，Dispatcher作为枢纽，接收来自用户界面（View）或者系统其它部分（services）的action，然后将其dispatch到所有Stores。Stores则根据action的不同动作，反馈给相对应注册的callback以更新state，同时通知View层数据/状态已改变，View层收到通知重新渲染。  
接下来我们看下各部分的大体实现。

### Dispatcher

Dispatcher作为中心枢纽管理整个应用的数据流，一般情况下只需要一个。因为他本质上只是一个注册中心，只负责将action分发到Stores。所以Dispatcher中注册的都是Stores接收action后要执行的callback。

```javascript
class Dispatcher {
  constructor() {
    this._callbacks = {};
    this._lastID = 1;
  }

  register(callback) {
    const id = `ID_${this._lastID++}`;
    this._callbacks[id] = callback;
    return id;
  }

  dispatch(payload) {
    // ...
    for (let id in this._callbacks) {
      this._callbacks[id](payload);
    }
  }
}
```

### Stores

Stores主要存储应用的状态state。Store在实例化是会将Dispatcher作为一个属性，并给提供一个接收action的callback。Stores在接收到dispatch的Action后，执行回调更新状态state，最后发布一个状态已改变的事件声明，订阅了的View则会重新获取状态重新渲染。

```javascript
// 基类，包含主要逻辑
class FluxStore {
  constructor(dispatcher) {
    // ...
    this._dispatcher = dispatcher;
    this.__emitter = new EventEmitter();
    this._dispatchToken = dispatcher.register((payload) => {
      this.__invokeOnDispatch(payload);
    });
  }

  getDispatcher() {
    return this._dispatcher;
  }

  // dispatcher中注册的callback调用方法
  __invokeOnDispatch(payload) {
    // ...
  }

  // ...
}

// Flux应用创建的store都应该继承这个类
class FluxReduceStore extends FluxStore {
  constructor(dispatcher) {
    super(dispatcher);
  
    this._state = this.getInitialState();
  }

  // 获取store的state
  getState() {
    return this._state;
  }

  // 抽象方法，初始化state
  getInitialState() {
    return abstractMethod('FluxReduceStore', 'getInitialState');
  }

  // 抽象方法，根据当前state和action动作，重新计算state
  reduce(state, action) {
    return abstractMethod('FluxReduceStore', 'reduce');
  }

  // 基类方法的实现，计算并更新state，并发出通知
  __invokeOnDispatch(action) {
    const startingState = this._state;
    const endingState = this.reduce(startingState, action);
    this._state = endingState;
    this.__emitter.emit('change');
  }

  // ...
}
```

### Action

我们开始的时候也说了，action会被传递给所有的Stores，那么如何判断这个action是更新哪一块state。这里，我们一般约定Action为具有两个属性的简单对象，type和payload。

```javascript
{
  type: 'DELETE_USER',
  payload: {
    userID: '...'
  }
}
```

type表示Action的具体动作，不同Stores接收Action后就会根据type进行相应的逻辑操作，payload则为执行动作所需的信息。

### View连接Store

我们现在知道了更新state的整个过程，那么View组件如何接收Stores的数据呢。我们很容易想到的解决方案就是HOC。通过一个容器组件来订阅Store的更新并获取更新后的state，然后将数据传给展示组件渲染。

```javascript
/**
 * 增强组件，使组件订阅store。
 * 
 * @param  {ReactClass} Base
 * @param  {FluxReduceStore} store
 */
function create(Base, store) {

  class ContainerClass extends Base {
    constructor(props) {
      super(props);

      // 订阅store数据改变，更新自身状态重新渲染
      store.__emitter.on('change', () => {
        this.setState(
          store.getState()
        );
      });

      // 初始化state
      const calculatedState = store.getState();
      this.state = {
        ...(this.state || {}),
        ...calculatedState,
      };
    }
  }

  return ContainerClass;
}
```