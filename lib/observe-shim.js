//    Copyright 2012 Kap IT (http://www.kapit.fr/)
//
//    Licensed under the Apache License, Version 2.0 (the 'License');
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an 'AS IS' BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.
//    Author : François de Campredon (http://francois.de-campredon.fr/),

// Object.observe PolyFill
// =======================

// *See [The harmony proposal page](http://wiki.ecmascript.org/doku.php?id=harmony:observe)*

(function (global) {
    'use strict';

    // Utilities
    // ---------

    // setImmediate shim used to deliver changes records asynchronously
    // use setImmediate if available
    var setImmediate = global.setImmediate || global.msSetImmediate,
        clearImmediate = global.clearImmediate || global.msClearImmediate;
    if (!setImmediate) {
        // fallback on setTimeout if not
        setImmediate = function (func, args) {
            return setTimeout(func, 0, args);
        };
        clearImmediate = function (id) {
            clearTimeout(id);
        };
    }


    // WeakMap
    // -------

    var PrivateMap;
    if (typeof WeakMap !== 'undefined')  {
        //use weakmap if defined
        PrivateMap = WeakMap;
    } else {
        //else use ses like sim of WeakMap
        /* jshint -W016 */
        var HIDDEN_PREFIX = '__weakmap:' + (Math.random() * 1e9 >>> 0),
            counter = new Date().getTime() % 1e9,
            mascot = {};

        PrivateMap = function () {
            this.name = HIDDEN_PREFIX + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
        };

        PrivateMap.prototype = {
            has: function (key) {
                return key && key.hasOwnProperty(this.name);
            },

            get: function (key) {
                var value = key && key[this.name];
                return value === mascot ? undefined : value;
            },

            set: function (key, value) {
                Object.defineProperty(key, this.name, {
                    value : typeof value === 'undefined' ? mascot : value,
                    enumerable: false,
                    writable : true,
                    configurable: true
                });
            },

            'delete': function (key) {
                return delete key[this.name];
            }
        };


        var getOwnPropertyName = Object.getOwnPropertyNames;
        Object.defineProperty(Object, 'getOwnPropertyNames', {
            value: function fakeGetOwnPropertyNames(obj) {
                return getOwnPropertyName(obj).filter(function (name) {
                    return name.substr(0, HIDDEN_PREFIX.length) !== HIDDEN_PREFIX;
                });
            },
            writable: true,
            enumerable: false,
            configurable: true
        });
    }


    // Internal Properties
    // -------------------

    // An ordered list used to provide a deterministic ordering in which callbacks are called.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#observercallbacks)
    var observerCallbacks = [];

    // This object is used as the prototype of all the notifiers that are returned by Object.getNotifier(O).
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#notifierprototype)
    var NotifierPrototype = Object.create(Object.prototype);

    // Used to store immediate uid reference
    var changeDeliveryImmediateUid;

    // Used to schedule a call to deliverAllChangeRecords
    function setUpChangesDelivery() {
        clearImmediate(changeDeliveryImmediateUid);
        changeDeliveryImmediateUid = setImmediate(deliverAllChangeRecords);
    }

    Object.defineProperty(NotifierPrototype, 'notify', {
        value: function (changeRecord) {
            var notifier = this;
            if (Object(notifier) !== notifier) {
                throw new TypeError('this must be an Object, given ' + notifier);
            }
            if (!notifier.__target) {
                return;
            }
            if (Object(changeRecord) !== changeRecord) {
                throw new TypeError('changeRecord must be an Object, given ' + changeRecord);
            }


            var type = changeRecord.type;
            if (typeof type !== 'string') {
                throw new TypeError('changeRecord.type must be a string, given ' + type);
            }

            var changeObservers = changeObserversMap.get(notifier);
            if (!changeObservers || changeObservers.length === 0) {
                return;
            }
            var target = notifier.__target,
                newRecord = Object.create(Object.prototype);
            Object.defineProperty(newRecord, 'object', {
                value: target,
                writable : false,
                enumerable : true,
                configurable: false
            });
            for (var prop in changeRecord) {
                if (prop !== 'object') {
                    var value = changeRecord[prop];
                    Object.defineProperty(newRecord, prop, {
                        value: value,
                        writable : false,
                        enumerable : true,
                        configurable: false
                    });
                }
            }
            Object.preventExtensions(newRecord);
            enqueueChangeRecord(notifier.__target, newRecord);
            setUpChangesDelivery();
        },
        writable: true,
        enumerable: false,
        configurable : true
    });

    Object.defineProperty(NotifierPrototype, 'performChange', {
        value: function (changeType, changeFn) {
            var notifier = this;
            if (Object(notifier) !== notifier) {
                throw new TypeError('this must be an Object, given ' + notifier);
            }
            if (!notifier.__target) {
                return;
            }
            if (typeof changeType !== 'string') {
                throw new TypeError('changeType must be a string given ' + notifier);
            }

            if (typeof changeFn !== 'function') {
                throw new TypeError('changeFn must be a function, given ' + changeFn);
            }
            beginChange(notifier.__target, changeType);
            var error;
            try {
                changeFn.call(undefined);
            } catch (e) {
                error = e;
            }
            endChange(notifier.__target, changeType);
            if (typeof error !== 'undefined') {
                throw error;
            }
        },
        writable: true,
        enumerable: false,
        configurable : true
    });

    // Implementation of the internal algorithm 'BeginChange'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#beginchange)
    function beginChange(object, changeType) {
        var notifier = Object.getNotifier(object),
            activeChanges = activeChangesMap.get(notifier),
            changeCount = activeChangesMap.get(notifier)[changeType];
        activeChanges[changeType] = typeof changeCount === 'undefined' ? 1 : changeCount + 1;
    }

    // Implementation of the internal algorithm 'EndChange'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#endchange)
    function endChange(object, changeType) {
        var notifier = Object.getNotifier(object),
            activeChanges = activeChangesMap.get(notifier),
            changeCount = activeChangesMap.get(notifier)[changeType];
        activeChanges[changeType] = changeCount > 0 ? changeCount - 1 : 0;
    }

    // Implementation of the internal algorithm 'ShouldDeliverToObserver'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#shoulddelivertoobserver)
    function shouldDeliverToObserver(observerRecord, activeChanges, changeRecord) {
        var acceptList = observerRecord.accept;
        if (acceptList) {
            for (var i = 0, l = acceptList.length; i < l; i++) {
                if (activeChanges[acceptList[i]] > 0) {
                    return false;
                }
            }

            // even if this one is not in the spec right now I guess it is just something that has been forgot,
            // or else the entire accept list is useless
            return acceptList.indexOf(changeRecord.type) !== -1;

        }
        return true;
    }

    // Map used to store corresponding notifier to an object
    var notifierMap = new PrivateMap(),
        changeObserversMap = new PrivateMap(),
        activeChangesMap = new PrivateMap();

    // Implementation of the internal algorithm 'GetNotifier'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#getnotifier)
    function getNotifier(target) {
        if (!notifierMap.has(target)) {
            var notifier = Object.create(NotifierPrototype);
            // we does not really need to hide this, since anyway the host object is accessible frome outside of the
            // implementation. we just make it unwrittable
            Object.defineProperty(notifier, '__target', { value : target });
            changeObserversMap.set(notifier, []);
            activeChangesMap.set(notifier, {});
            notifierMap.set(target, notifier);
        }
        return notifierMap.get(target);
    }



    // map used to store reference to a list of pending changeRecords
    // in observer callback.
    var pendingChangesMap = new PrivateMap();

    // Implementation of the internal algorithm 'EnqueueChangeRecord'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#enqueuechangerecord)
    function enqueueChangeRecord(object, changeRecord) {
        var notifier = Object.getNotifier(object),
            activeChanges = activeChangesMap.get(notifier),
            changeObservers = changeObserversMap.get(notifier);
        for (var i = 0, l = changeObservers.length; i < l; i++) {
            var observerRecord = changeObservers[i];
            if (shouldDeliverToObserver(observerRecord, activeChanges, changeRecord)) {
                var observer = observerRecord.callback,
                    pendingChangeRecords = [];
                if (!pendingChangesMap.has(observer))  {
                    pendingChangesMap.set(observer, pendingChangeRecords);
                } else {
                    pendingChangeRecords = pendingChangesMap.get(observer);
                }
                pendingChangeRecords.push(changeRecord);
            }
        }
    }

    // map used to store a count of associated notifier to a function
    var attachedNotifierCountMap = new PrivateMap();

    // Remove reference all reference to an observer callback,
    // if this one is not used anymore.
    // In the proposal the ObserverCallBack has a weak reference over observers,
    // Without this possibility we need to clean this list to avoid memory leak
    function cleanObserver(observer) {
        if (!attachedNotifierCountMap.get(observer) && !pendingChangesMap.has(observer)) {
            var index = observerCallbacks.indexOf(observer);
            if (index !== -1) {
                observerCallbacks.splice(index, 1);
            }
        }
    }

    // Implementation of the internal algorithm 'DeliverChangeRecords'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#deliverchangerecords)
    function deliverChangeRecords(observer) {
        var pendingChangeRecords = pendingChangesMap.get(observer);
        pendingChangesMap.delete(observer);
        if (!pendingChangeRecords || pendingChangeRecords.length === 0) {
            return false;
        }
        try {
            observer.call(undefined, pendingChangeRecords);
        }
        catch (e) { }

        cleanObserver(observer);
        return true;
    }

    // Implementation of the internal algorithm 'DeliverAllChangeRecords'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#deliverallchangerecords)
    function deliverAllChangeRecords() {
        var observers = observerCallbacks.slice();
        var anyWorkDone = false;
        for (var i = 0, l = observers.length; i < l; i++) {
            var observer = observers[i];
            if (deliverChangeRecords(observer)) {
                anyWorkDone = true;
            }
        }
        return anyWorkDone;
    }




    // Implementation of the public api 'Object.observe'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.observe)
    Object.observe = function (target, observer, accept) {
        if (Object(target) !== target) {
            throw new TypeError('target must be an Object, given ' + target);
        }
        if (typeof observer !== 'function') {
            throw new TypeError('observer must be a function, given ' + observer);
        }

        if (Object.isFrozen(observer)) {
            throw new TypeError('observer cannot be frozen');
        }

        var acceptList;

        if (typeof accept !== 'undefined') {
            if (Object(accept) !== accept) {
                throw new TypeError('accept must be an object, given ' + accept);
            }
            var len = accept.length;
            if (typeof len !== 'number' || len >>> 0 !== len || len < 1) {
                throw new TypeError('the \'length\' property of accept must be a positive integer, given ' + len);
            }

            var nextIndex = 0;

            acceptList = [];
            while (nextIndex < len) {
                var next = accept[nextIndex];
                if (typeof next !== 'string') {
                    throw new TypeError('accept must contains only string, given' + next);
                }
                acceptList.push(next);
                nextIndex++;
            }
        }


        var notifier = getNotifier(target),
            changeObservers = changeObserversMap.get(notifier);

        for (var i = 0, l = changeObservers.length; i < l; i++) {
            if (changeObservers[i].callback === observer) {
                changeObservers[i].accept = acceptList;
                return target;
            }
        }

        changeObservers.push({
            callback: observer,
            accept: acceptList
        });

        if (observerCallbacks.indexOf(observer) === -1)  {
            observerCallbacks.push(observer);
        }
        if (!attachedNotifierCountMap.get(observer)) {
            attachedNotifierCountMap.set(observer, 0);
        }
        attachedNotifierCountMap.set(observer, attachedNotifierCountMap.get(observer) + 1);
        return target;
    };

    // Implementation of the public api 'Object.unobseve'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.unobseve)
    Object.unobserve = function (target, observer) {
        if (Object(target) !== target) {
            throw new TypeError('target must be an Object, given ' + target);
        }
        if (typeof observer !== 'function') {
            throw new TypeError('observer must be a function, given ' + observer);
        }
        var notifier = getNotifier(target),
            changeObservers = changeObserversMap.get(notifier);
        for (var i = 0, l = changeObservers.length; i < l; i++) {
            if (changeObservers[i].callback === observer) {
                changeObservers.splice(i, 1);
                attachedNotifierCountMap.set(observer, attachedNotifierCountMap.get(observer) - 1);
                cleanObserver(observer);
                break;
            }
        }
        return target;
    };

    // Implementation of the public api 'Object.deliverChangeRecords'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.deliverchangerecords)
    Object.deliverChangeRecords = function (observer) {
        if (typeof observer !== 'function') {
            throw new TypeError('callback must be a function, given ' + observer);
        }
        while (deliverChangeRecords(observer)) {}
    };

    // Implementation of the public api 'Object.getNotifier'
    // described in the proposal.
    // [Corresponding Section in ECMAScript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.getnotifier)
    Object.getNotifier = function (target) {
        if (Object(target) !== target) {
            throw new TypeError('target must be an Object, given ' + target);
        }
        return getNotifier(target);
    };


})(typeof global !== 'undefined' ? global : this);


