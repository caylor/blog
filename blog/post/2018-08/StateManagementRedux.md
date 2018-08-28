---
title: "React状态管理 —— Redux篇"
date: "2018-08-18"
tags: 
    - React
    - Redux
---

Redux 是一个类似于 Flux 的库，同样遵从“单向数据流”原则。

<!-- excerpt_end -->

相比于 Flux ，Redux 同样专注于数据修改逻辑，也是通过`action`来描述具体的改变。不同点在于 Redux 没有 Dispatcher 这个模块，Redux 的 dispach 动作由 store 来完成，通过纯函数重新计算 state 。同时，Redux 假定状态内部数据不可修改，每次都应返回新的对象。  

Redux的三个基本原则：  
* 单一数据源：应用所有的 state 以树的形式存在一个 store 对象中。
* state 只读：只能通过发送 action 修改返回新的 state 。
* 数据改变只能通过纯函数完成。

### 数据流

```javascript
/**
 * 
 *                                +--------+
 *                          +-----| Action |<----+
 *                          |     +--------+     |
 *                          v                    |
 *   +---------+        +-------+           +--------+
 *   | Reducer |------->| Store |---------->|  View  |
 *   +---------+        +-------+           +--------+
 * 
 */
```

### Action

与 Flux 中的 Action 一样，是一个拥有`type`属性的 plain object ，`type`表明需要进行的操作。项目中为了便于管理维护，我们通常将Types定义为常量。

```javascript
const DELETE_POST = 'DELETE_POST'
```

```javascript
{
  type: DELETE_POST,
  id: 1
}
```

同样，我们也可以借助 Action Creator 生成 Action 。

```javascript
const deletePost = id => ({
  type: DELETE_POST,
  id
})
```

### Reducer

Reducer 的任务是接收旧的 state 及`action`，返回新的 state 。

```javascript
(prevState, action) => newState
```

Reducer 有两个特点：
* 必须是纯函数：在输入不变的情况下，永远返回相同结果。
* 没有副作用：不能有异步请求、路由跳转等等的操作。

我们写一个基本的 Reducer 函数：

```javascript
function posts(state, action) {
  switch (action.type) {
    case ADD_POST:
      return [...state, action.post]
    // ...
    default:
      return state
  }
}
```

方法中会根据`action.type`进行不同的操作，重新计算并返回新的state。如果应用比较大，为了更好的组件化开发，我们需要将 reducers 拆分，每个组件对应的 reducer 管理自己的 state 部分。

```javascript
const initialState = {
  posts: [],
  about: ''
}

function posts(state = [], action) {
  switch (action.type) {
    case ADD_POST:
      return [...state, action.post]
    default:
      return state
  }
}

function about(state = '', action) {
  switch (action.type) {
    case MODIFY_ABOUT:
      return action.about
    default:
      return state
  }
}

function blog(state = initialState, action) {
  return {
    posts: posts(state.posts, action),
    about: about(state.about, action)
  }
}
```

我们也可以用 Redux 提供的辅助函数`combineReducers`重组 reducer 。

```javascript
import { combineReducers } from 'redux'

const blog = combineReducers({
  posts,
  about
})
```

### Store

这里需要再次强调的是，应用只应有唯一 store，如果想分开做数据处理，可以使用我们上面讲过的 reducers 拆分方法。  
store 除了存储 state 外，还负责分发 action 、订阅事件等。我们可以通过 Redux 提供的辅助函数`createStore`创建 store 。接下来我们就通过源码来了解 Store 的功能及具体实现。

createStore.js
```javascript
export default function createStore(reducer, preloadedState, enhancer) {
  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState
    preloadedState = undefined
  }

  // 通过三方插件等增强 store，插件通过 applyMiddleware 方法加载
  if (typeof enhancer === 'function') {
    return enhancer(createStore)(reducer, preloadedState)
  }

  let currentReducer = reducer
  let currentState = preloadedState
  let currentListeners = []
  let nextListeners = currentListeners
  let isDispatching = false

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  /**
   * 读取当前的 state 树
   */
  function getState() {
    return currentState
  }

  /**
   * 订阅事件，每次dispatched后触发
   */
  function subscribe(listener) {
    let isSubscribed = true

    ensureCanMutateNextListeners()
    nextListeners.push(listener)

    return function unsubscribe() {
      if (!isSubscribed) {
        return
      }

      isSubscribed = false

      ensureCanMutateNextListeners()
      const index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1)
    }
  }

  /**
   * 改变state的唯一途径。调用reducer重新计算state。
   */
  function dispatch(action) {
    // ...
    try {
      isDispatching = true
      currentState = currentReducer(currentState, action)
    } finally {
      isDispatching = false
    }

    // 执行订阅事件
    const listeners = currentListeners = nextListeners
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }
    return action
  }

  /**
   * 替换当前的reducer
   */
  function replaceReducer(nextReducer) {
    currentReducer = nextReducer
    dispatch({ type: ActionTypes.INIT })
  }

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
  }
}
```

### Middleware

Middleware 在 dispatch action 时提供一个扩展，以满足我们的一些业务或其他需求。  
如何理解呢，我们以写日志`log`为例，当我们需要记录每一个`action`时，我们可以封装这样一个函数：

```javascript
const dispatchAndLog = (store, action) => {
  log('action: ', action)
  store.dispatch(action)
}
```

这样我们就可以任何地方引用`dispatchAndLog`。但这仍然不够方便，我们可以通过 monkey patch 重写`dispatch`方法：

```javascript
const logger = store => {
  const next = store.dispatch

  return action => {
    log('action: ', action)
    next(action)
  }
}

store.dispatch = logger(store)
```

我们再写一个辅助函数来满足多个 middleware 扩展`dispatch`方法。

```javascript
function applyMiddleware(store, middlewares) {
  middlewares.forEach(middleware =>
    store.dispatch = middleware(store)
  )
}
```

monkey patch 只是一个 hack 手段，本质上还是为了重写`dispatch`方法以供其他 middleware 访问。那么更优的方案应该是将`dispatch`参数化以便链式调用。我们重写一下上面的方法。

```javascript
const logger = store => next => action => {
  log('action: ', action)
  next(action)
}

function applyMiddleware(store, middlewares) {
  let dispatch = store.dispatch

  middlewares.forEach(middleware => 
    dispatch = middleware(store)(dispatch)
  )

  return {
    ...store,
    dispatch
  }
}
```

这样我们就基本理解了 middleware 的用法。下面我们看一下 Redux 关于`applyMiddleware` 的实现。

```javascript
export default function applyMiddleware(...middlewares) {
  // 即 createStore 的参数 enhancer
  return (createStore) => (reducer, preloadedState, enhancer) => {
    const store = createStore(reducer, preloadedState, enhancer)
    let dispatch = store.dispatch
    let chain = []

    // middleware 中只能访问 getState 和 dispatch 方法
    const middlewareAPI = {
      getState: store.getState,
      dispatch: (action) => dispatch(action)
    }
    chain = middlewares.map(middleware => middleware(middlewareAPI))
    dispatch = compose(...chain)(store.dispatch)

    return {
      ...store,
      dispatch
    }
  }
}

function compose(...funcs) {
  // ...
  return funcs.reduce((a, b) => (...args) => a(b(...args)))
}
```

### 连接 React 组件

连接主要通过 [react-redux](https://github.com/reduxjs/react-redux) 模块。模块主要包含两部分：

* Provider 组件：接收 store 并通过 context API 注入。
* connect 函数：订阅 store 的更新及重新渲染组件。

Provider 组件将 store 注入系统，使得所有子组件都能通过 React 的 context API 来访问 store 。  

Provider.js
```javascript
export default class Provider extends Component {
  // React Context API，注入 store
  getChildContext() {
    return { store: this.store }
  }

  constructor(props, context) {
    super(props, context)
    this.store = props.store
  }

  render() {
    return Children.only(this.props.children)
  }
}
```

connect 方法接收参数`mapStateToProps`，`mapDispatchToProps`，将 store 当前状态及`dispatch`函数转为键值对，与其他`props`合并，通过 HOC 返回新组件。

connect.js
```javascript
export default function connect(mapStateToProps, mapDispatchToProps, mergeProps, options = {}) {

  return function wrapWithConnect(WrappedComponent) {

    class Connect extends Component {
      constructor(props, context) {
        super(props, context)
        this.store = props.store || context.store
        const storeState = this.store.getState()
        this.state = { storeState }
      }

      componentDidMount() {
        // 订阅 store 的更新
        this.unsubscribe = this.store.subscribe(this.handleChange.bind(this))
        this.handleChange()
      }

      componentWillUnmount() {
        this.unsubscribe()
      }

      // 设置 state 为最新 storeState
      handleChange() {
        const storeState = this.store.getState()
        this.setState({ storeState })
      }

      // ...

      render() {
        // ...
        // 将 state 转为 props
        if (shouldUpdateStateProps) {
          haveStatePropsChanged = this.updateStatePropsIfNeeded()
        }
        // 将 dispatch 转为 props
        if (shouldUpdateDispatchProps) {
          haveDispatchPropsChanged = this.updateDispatchPropsIfNeeded()
        }
        // 合并 stateProps, dipatchPros 及其他 props
        if (
          haveStatePropsChanged ||
          haveDispatchPropsChanged ||
          haveOwnPropsChanged
        ) {
          this.updateMergedPropsIfNeeded()
        }
        this.renderedElement = createElement(WrappedComponent,
          this.mergedProps
        )
        return this.renderedElement
      }
    }

    // 生成HOC
    return hoistStatics(Connect, WrappedComponent)
  }
}
```