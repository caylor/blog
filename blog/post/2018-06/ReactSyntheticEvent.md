---
title: "React源码解析 4 —— 合成事件"
date: "2018-06-07"
tags: 
    - React
---

React合成事件是一个跨浏览器原生事件包装器，具有与浏览器原生事件相同的接口。

<!-- excerpt_end -->

我们先看下合成系统框图：

```javascript
/**
 * Overview of React and the event system:
 *
 * +------------+    .
 * |    DOM     |    .
 * +------------+    .
 *       |           .
 *       v           .
 * +------------+    .
 * | ReactEvent |    .
 * |  Listener  |    .
 * +------------+    .                         +-----------+
 *       |           .               +--------+|SimpleEvent|
 *       |           .               |         |Plugin     |
 * +-----|------+    .               v         +-----------+
 * |     |      |    .    +--------------+                    +------------+
 * |     +-----------.--->|EventPluginHub|                    |    Event   |
 * |            |    .    |              |     +-----------+  | Propagators|
 * | ReactEvent |    .    |              |     |TapEvent   |  |------------|
 * |  Emitter   |    .    |              |<---+|Plugin     |  |other plugin|
 * |            |    .    |              |     +-----------+  |  utilities |
 * |     +-----------.--->|              |                    +------------+
 * |     |      |    .    +--------------+
 * +-----|------+    .                ^        +-----------+
 *       |           .                |        |Enter/Leave|
 *       +           .                +-------+|Plugin     |
 * +-------------+   .                         +-----------+
 * | application |   .
 * |-------------|   .
 * |             |   .
 * |             |   .
 * +-------------+   .
 *                   .
 */
```

主要的几个模块：

* ReactEventListener：负责事件的注册。
* ReactEventEmitter：负责事件的分发。
* EventPluginHub：负责事件的存储及分发。
* Plugin：根据不同的事件类型构造不同的合成事件。

## 1.事件注册

我们知道组件在渲染时会递归调用不同类型的组件及子组件的`mountComponent`方法，最终会调用`ReactDOMComponent`组件来解析标签及注册事件。

ReactDOMComponent.js
```javascript
mountComponent: function (transaction, hostParent, hostContainerInfo, context) {
  // ...
  var props = this._currentElement.props;
  // ...
  this._updateDOMProperties(null, props, transaction);
  // ...
}

_updateDOMProperties: function (lastProps, nextProps, transaction) {
  // ...
  for (propKey in nextProps) {
    var nextProp = nextProps[propKey];
    var lastProp = propKey === STYLE ? this._previousStyleCopy : lastProps != null ? lastProps[propKey] : undefined;
    if (!nextProps.hasOwnProperty(propKey) || nextProp === lastProp || nextProp == null && lastProp == null) {
      continue;
    }
    if (propKey === STYLE) {
      // ...
    } else if (registrationNameModules.hasOwnProperty(propKey)) {
      if (nextProp) {
        enqueuePutListener(this, propKey, nextProp, transaction);
      } else if (lastProp) {
        deleteListener(this, propKey);
      }
    }
  }
  // ...
}
```

不难发现渲染过程中是通过调用`enqueuePutListener`进行事件注册的。

```javascript
function enqueuePutListener(inst, registrationName, listener, transaction) {
  var containerInfo = inst._hostContainerInfo;
  var isDocumentFragment = containerInfo._node && containerInfo._node.nodeType === DOC_FRAGMENT_TYPE;
  var doc = isDocumentFragment ? containerInfo._node : containerInfo._ownerDocument;
  listenTo(registrationName, doc);
  transaction.getReactMountReady().enqueue(putListener, {
    inst: inst,
    registrationName: registrationName,
    listener: listener
  });
}
```

`enqueuePutListener`做了两件事：  
1. `listenTo`将事件注册到document上。  
2. 事务方式调用`putListener`存储事件。  

我们看到事件系统有一个特点，他会把事件全部注册到document这个元素DOM上，主要是为了解决一些浏览器的部分事件触发及表现问题，如 [iOS quirks](http://www.quirksmode.org/blog/archives/2010/09/click_event_del.html) 等等。

`listenTo`的实现里则主要是调用`ReactEventListener`的`trapBubbledEvent`和`trapCapturedEvent`方法注册冒泡和捕获事件，同时解决了不同浏览器的捕获冒泡不兼容问题。

我们这里就以`trapBubbledEvent`为例分析一下。

ReactEventListener.js
```javascript
trapBubbledEvent: function (topLevelType, handlerBaseName, element) {
  if (!element) {
    return null;
  }
  return EventListener.listen(element, handlerBaseName, ReactEventListener.dispatchEvent.bind(null, topLevelType));
}
```

EventListener.js
```javascript
listen: function listen(target, eventType, callback) {
  if (target.addEventListener) {
    target.addEventListener(eventType, callback, false);
    return {
      remove: function remove() {
        target.removeEventListener(eventType, callback, false);
      }
    };
  } else if (target.attachEvent) {
    target.attachEvent('on' + eventType, callback);
    return {
      remove: function remove() {
        target.detachEvent('on' + eventType, callback);
      }
    };
  }
}
```

最终在`listen`中通过原生方法`addEventListener`完成注册。

## 2.事件存储

事件注册后，系统会将事件存储起来。

EventPluginHub.js
```javascript
var getDictionaryKey = function (inst) {
  return '.' + inst._rootNodeID;
};

var EventPluginHub = {
  // ...
  putListener: function (inst, registrationName, listener) {
    var key = getDictionaryKey(inst);
    var bankForRegistrationName = listenerBank[registrationName] || (listenerBank[registrationName] = {});
    bankForRegistrationName[key] = listener;

    var PluginModule = EventPluginRegistry.registrationNameModules[registrationName];
    if (PluginModule && PluginModule.didPutListener) {
      PluginModule.didPutListener(inst, registrationName, listener);
    }
  }
  // ...
};
```

事件被按名称和组件实例划分存储在`listenerBank`这个二维数组中，若事件（onClick、onSelect）注册了`didPutListener`，则调用回调。`didPutListener`主要解决 [workaround](http://www.quirksmode.org/blog/archives/2010/09/click_event_del.html)在部分浏览器中的兼容问题。

## 3.事件分发

当事件触发时，会执行注册的回调函数`ReactEventListener.dispatchEvent`。

ReactEventListener.js
```javascript
dispatchEvent: function (topLevelType, nativeEvent) {
  if (!ReactEventListener._enabled) {
    return;
  }

  var bookKeeping = TopLevelCallbackBookKeeping.getPooled(topLevelType, nativeEvent);
  try {
    ReactUpdates.batchedUpdates(handleTopLevelImpl, bookKeeping);
  } finally {
    TopLevelCallbackBookKeeping.release(bookKeeping);
  }
}
```

可以看到事件流也是以消息队列的方式执行，我们接着看下`handleTopLevelImpl`是如何进行事件分发的。

```javascript
function handleTopLevelImpl(bookKeeping) {
  var nativeEventTarget = getEventTarget(bookKeeping.nativeEvent);
  var targetInst = ReactDOMComponentTree.getClosestInstanceFromNode(nativeEventTarget);

  var ancestor = targetInst;
  do {
    bookKeeping.ancestors.push(ancestor);
    ancestor = ancestor && findParent(ancestor);
  } while (ancestor);

  for (var i = 0; i < bookKeeping.ancestors.length; i++) {
    targetInst = bookKeeping.ancestors[i];
    ReactEventListener._handleTopLevel(bookKeeping.topLevelType, targetInst, bookKeeping.nativeEvent, getEventTarget(bookKeeping.nativeEvent));
  }
}
```

`handleTopLevelImpl`的执行逻辑：  
1. 获取事件触发的target节点`nativeEventTarget`和对应的组件对象`targetInst`。
2. 由当前组件向上遍历所有父组件，得到组件数组`bookKeeping.ancestors`。
3. 遍历组件数组，通过`_handleTopLevel`调用注册的回调。

## 4.事件执行

ReactEventEmitterMixin.js
```javascript
handleTopLevel: function (topLevelType, targetInst, nativeEvent, nativeEventTarget) {
  var events = EventPluginHub.extractEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget);
  runEventQueueInBatch(events);
}
```

`handleTopLevel`做了两件事：合成事件和批处理事件。  
我们先看下合成事件的逻辑。

EventPluginHub.js
```javascript
extractEvents: function (topLevelType, targetInst, nativeEvent, nativeEventTarget) {
  var events;
  var plugins = EventPluginRegistry.plugins;
  for (var i = 0; i < plugins.length; i++) {
    var possiblePlugin = plugins[i];
    if (possiblePlugin) {
      var extractedEvents = possiblePlugin.extractEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget);
      if (extractedEvents) {
        events = accumulateInto(events, extractedEvents);
      }
    }
  }
  return events;
}
```

方法遍历`EventPluginRegistry.plugins`，通过执行不同plugin的`extractEvents`构造不同的合成事件，最终获得`events`。  
`EventPluginRegistry.plugins`会在初始化阶段注入，主要包含`SimpleEventPlugin`、`EnterLeaveEventPlugin`等plugin。

获得合成事件数组`events`后，就调用`runEventQueueInBatch`开始进行批处理。

```javascript
function runEventQueueInBatch(events) {
  EventPluginHub.enqueueEvents(events);
  EventPluginHub.processEventQueue(false);
}
```

EventPluginHub.js
```javascript
var EventPluginHub = {
  // ...
  enqueueEvents: function (events) {
    if (events) {
      eventQueue = accumulateInto(eventQueue, events);
    }
  }

  processEventQueue: function (simulated) {
    var processingEventQueue = eventQueue;
    eventQueue = null;
    if (simulated) {
      forEachAccumulated(processingEventQueue, executeDispatchesAndReleaseSimulated);
    } else {
      forEachAccumulated(processingEventQueue, executeDispatchesAndReleaseTopLevel);
    }
    ReactErrorUtils.rethrowCaughtError();
  }
  // ...
}
```

`runEventQueueInBatch`中先执行`enqueueEvents`，构造在`processEventQueue`调用时分发的合成事件队列，然后调用`processEventQueue`，遍历队列中的事件，调用`executeDispatchesAndReleaseTopLevel`处理每个事件。

```javascript
var executeDispatchesAndRelease = function (event, simulated) {
  if (event) {
    EventPluginUtils.executeDispatchesInOrder(event, simulated);

    if (!event.isPersistent()) {
      event.constructor.release(event);
    }
  }
};

var executeDispatchesAndReleaseTopLevel = function (e) {
  return executeDispatchesAndRelease(e, false);
};
```

`executeDispatchesAndRelease`通过`executeDispatchesInOrder`将事件分发，处理完后，将`event`对象`release`掉，使其返回对象池。

EventPluginUtils.js
```javascript
function executeDispatchesInOrder(event, simulated) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchInstances = event._dispatchInstances;
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      executeDispatch(event, simulated, dispatchListeners[i], dispatchInstances[i]);
    }
  } else if (dispatchListeners) {
    executeDispatch(event, simulated, dispatchListeners, dispatchInstances);
  }
  event._dispatchListeners = null;
  event._dispatchInstances = null;
}
```

`executeDispatchesInOrder`中先获得`event`对应的listeners队列，如果是数组，则遍历执行`executeDispatch`，即由当前元素向父元素冒泡，若某个`event`设置了`isPropagationStopped`为`true`，则停止冒泡，退出循环。如果只有一个listener，直接执行`executeDispatch`分发。

```javascript
function executeDispatch(event, simulated, listener, inst) {
  var type = event.type || 'unknown-event';
  event.currentTarget = EventPluginUtils.getNodeFromInstance(inst);
  if (simulated) {
    ReactErrorUtils.invokeGuardedCallbackWithCatch(type, listener, event);
  } else {
    ReactErrorUtils.invokeGuardedCallback(type, listener, event);
  }
  event.currentTarget = null;
}

// ReactErrorUtils.js
function invokeGuardedCallback(name, func, a) {
  try {
    func(a);
  } catch (x) {
    if (caughtError === null) {
      caughtError = x;
    }
  }
}
```

最终`executeDispatch`中调用`invokeGuardedCallback`，执行注册的callback方法。

## 5.总结

React将组件上注册的事件全部绑定到document上，且通过对象池管理合成事件的创建及销毁，以队列的方式，从触发组件向父组件回溯，调用相应的callback，自身实现了一套冒泡机制。