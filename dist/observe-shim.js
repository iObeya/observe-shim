
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

// *See (http://wiki.ecmascript.org/doku.php?id=harmony:observe)*

(function (global) {
    'use strict';



    // Utilities
    // ---------

    // IsObject ES5 internal algorithm shim
    function isObject(obj) {
        return obj && typeof obj === 'object';
    }

    // IsCallable ES5 internal algorithm shim
    function isCallable(func) {
        return typeof func === 'function';
    }

    // setImmediate shim used to deliver changes records asynchronously

    //use buit in if exist
    var setImmediate = global.setImmediate || global.msSetImmediate;
    var clearImmediate = global.clearImmediate || global.msClearImmediate;
    if (!setImmediate) {
        // fallback on setTimeout if nothing else can be used
        setImmediate = function (func, args) {
            return setTimeout(func, 0, args);
        };
        clearImmediate = function (id) {
            clearTimeout(id);
        };
    }



    // Internal Properties
    // -------------------

    // An ordered list used to provide a deterministic ordering in which callbacks are called.
    // see http://wiki.ecmascript.org/doku.php?id=harmony:observe#observercallbacks
    var observerCallbacks = [];

    // This object is used as the prototype of all the notifiers that are returned by Object.getNotifier(O).
    // see http://wiki.ecmascript.org/doku.php?id=harmony:observe#notifierprototype
    var NotifierPrototype = Object.create(Object.prototype);
    Object.defineProperty(NotifierPrototype, 'notify', {
        value: function (changeRecord) {
            var notifier = this;
            if (!isObject(notifier)) {
                throw new TypeError('this must be an Object, given ' + notifier);
            }
            if (!isObject(changeRecord)) {
                throw new TypeError('changeRecord must be an Object, given ' + changeRecord);
            }
            if (!this.target) {
                return;
            }

            var type = changeRecord.type;
            if (typeof type !== 'string') {
                throw new TypeError('changeRecord.type must be a string, given ' + type);
            }

            var changeObservers = notifier.changeObservers;
            if (!changeObservers || changeObservers.length === 0) {
                return;
            }
            var target = notifier.target,
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
            enqueueChangeRecord(newRecord, changeObservers);
            setUpChangesDelivery();
        },
        writable: true,
        enumerable: false,
        configurable : true
    });

    // Used to store immediate uid reference
    var changeDeliveryImmediateUid;

    // Used to schedule a call to deliverAllChangeRecords
    function setUpChangesDelivery() {
        clearImmediate(changeDeliveryImmediateUid);
        changeDeliveryImmediateUid = setImmediate(deliverAllChangeRecords, 0);
    }



    // Key used to store reference to notifier in objects
    var notifierProperty = '__notifier__';

    // Implementation of the internal algorithm 'GetNotifier'
    // described in the proposal.
    // See http://wiki.ecmascript.org/doku.php?id=harmony:observe#getnotifier
    function getNotifier(target) {
        if (!target.hasOwnProperty(notifierProperty)) {
            var notifier = Object.create(NotifierPrototype);
            notifier.target = target;
            notifier.changeObservers = [];

            Object.defineProperty(target, notifierProperty, {
                value : notifier,
                enumerable: false,
                configurable: true,
                writable: true
            });
        }
        return target[notifierProperty];
    }



    // Key used to store reference to a list of pending changeRecords
    // in observer callback.
    var pendingChangesProperty  = '__pendingChangeRecords__';

    // Implementation of the internal algorithm 'EnqueueChangeRecord'
    // described in the proposal.
    // See http://wiki.ecmascript.org/doku.php?id=harmony:observe#enqueuechangerecord
    function enqueueChangeRecord(newRecord, observers) {
        for (var i = 0, l = observers.length; i < l; i++) {
            var observer =  observers[i];
            if (!observer.hasOwnProperty(pendingChangesProperty))  {
                Object.defineProperty(observer, pendingChangesProperty, {
                    value : null,
                    enumerable: false,
                    configurable: true,
                    writable: true
                });
            }
            var pendingChangeRecords  = observer[pendingChangesProperty] || (observer[pendingChangesProperty] = []);
            pendingChangeRecords.push(newRecord);
        }
    }

    // key used to store a count of associated notifier to a function
    var attachedNotifierCountProperty = '___attachedNotifierCount__';

    // In the proposal the ObserverCallBack has a weak reference over observers,
    // Without this possibility we need to clean this list to avoid memory leak
    // Remove reference all reference to an observer callback,
    // if this one is not used anymore.
    function cleanObserver(observer) {
        if (!observer[attachedNotifierCountProperty] && !observer[pendingChangesProperty]) {
            var index = observerCallbacks.indexOf(observer);
            if (index !== -1) {
                observerCallbacks.splice(index, 1);
            }
        }
    }

    // Implementation of the internal algorithm 'DeliverChangeRecords'
    // described in the proposal.
    // See http://wiki.ecmascript.org/doku.php?id=harmony:observe#deliverchangerecords
    function deliverChangeRecords(observer) {
        var pendingChangeRecords = observer[pendingChangesProperty];
        observer[pendingChangesProperty] = null;
        if (!pendingChangeRecords || pendingChangeRecords.length === 0) {
            return false;
        }
        try {
            observer.call(undefined, pendingChangeRecords);
        }
        catch (e) {
            //TODO examine this
            console.log(e);
        }

        cleanObserver(observer);
        return true;
    }

    // Implementation of the internal algorithm 'DeliverAllChangeRecords'
    // described in the proposal.
    // See http://wiki.ecmascript.org/doku.php?id=harmony:observe#deliverallchangerecords
    function deliverAllChangeRecords() {
        var observers = observerCallbacks;
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
    // See http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.observe
    Object.observe = function (target, observer) {
        if (typeof target !== 'object') {
            throw new TypeError('target must be an Object, given ' + target);
        }
        if (typeof observer !== 'function') {
            throw new TypeError('observerCallBack must be a function, given ' + observer);
        }

        if (Object.isFrozen(observer)) {
            throw new TypeError('observer cannot be frozen');
        }

        var notifier = getNotifier(target),
            changeObservers = notifier.changeObservers;

        if (changeObservers.indexOf(observer) === -1) {
            changeObservers.push(observer);
            if (observerCallbacks.indexOf(observer) === -1)  {
                observerCallbacks.push(observer);
            }
            if (!observer.hasOwnProperty(attachedNotifierCountProperty)) {
                Object.defineProperty(observer, attachedNotifierCountProperty, {
                    value : 0,
                    enumerable: false,
                    configurable: true,
                    writable: true
                });
            }
            observer[attachedNotifierCountProperty]++;
        }
        return target;
    };

    // Implementation of the public api 'Object.unobseve'
    // described in the proposal.
    // See http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.unobseve
    Object.unobserve = function (target, observer) {
        if (!isObject(target)) {
            throw new TypeError('target must be an Object, given ' + target);
        }
        if (typeof observer !== 'function') {
            throw new TypeError('observerCallBack must be a function, given ' + observer);
        }
        var notifier = getNotifier(target);
        var changeObservers = notifier.changeObservers;
        var index = notifier.changeObservers.indexOf(observer);
        if (index !== -1) {
            changeObservers.splice(index, 1);
            observer[attachedNotifierCountProperty]--;
            cleanObserver(observer);
        }
        return target;
    };

    // Implementation of the public api 'Object.deliverChangeRecords'
    // described in the proposal.
    // See http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.deliverchangerecords
    Object.deliverChangeRecords = function (observer) {
        if (!isCallable(observer)) {
            throw new TypeError('callback must be a function, given ' + observer);
        }
        while (deliverChangeRecords(observer)) {}
        return;
    };

    // Implementation of the public api 'Object.getNotifier'
    // described in the proposal.
    // See http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.getnotifier
    Object.getNotifier = function (target) {
        if (!isObject(target)) {
            throw new TypeError('target must be an Object, given ' + target);
        }
        return getNotifier(target);
    };


})(this);



(function (global) {
    'use strict';

    var ObserveUtils;
    if (typeof exports !== 'undefined') {
        ObserveUtils = exports;
    } else {
        ObserveUtils = global.ObserveUtils = {};
    }

    // Utilities
    // ---------


    // return true is the given descriptor contains accessor
    function isAccessorDescriptor(desc) {
        if (desc === undefined) {
            return false;
        }
        return ('get' in desc || 'set' in desc);
    }



    // getProperty descriptor
    // copied from http://wiki.ecmascript.org/doku.php?id=harmony:egal
    function getPropertyDescriptor(target, name) {
        var pd = Object.getOwnPropertyDescriptor(target, name), // calls getOwnPropertyDescriptor trap
            proto = Object.getPrototypeOf(target);
        while (typeof pd === 'undefined' && proto !== null) {
            pd = Object.getOwnPropertyDescriptor(proto, name);
            proto = Object.getPrototypeOf(proto);
        }
        return pd;
    }

    // IsObject ES5 internal algorithm shim
    function isObject(obj) {
        return obj && typeof obj === 'object';
    }

    // egal shim
    // copied from http://wiki.ecmascript.org/doku.php?id=harmony:egal
    function sameValue(x, y) {
        if (x === y) {
            // 0 === -0, but they are not identical
            return x !== 0 || 1 / x === 1 / y;
        }

        // NaN !== NaN, but they are identical.
        // NaNs are the only non-reflexive value, i.e., if x !== x,
        // then x is a NaN.
        // isNaN is broken: it converts its argument to number, so
        // isNaN('foo') => true
        return x !== x && y !== y;
    }

    // Implementation
    // ---------

    // Uid generation helper
    var uidCounter = 0;

    // Define a property on an object that will call the Notifier.notify method when updated
    function defineObservableProperty(target, property, originalValue) {
        var internalPropName = '_' + (uidCounter++) + property;

        Object.defineProperty(target, internalPropName, {
            value: originalValue,
            writable: true,
            enumerable: false,
            configurable: true
        });

        Object.defineProperty(target, property, {
            get: function () {
                return this[internalPropName];
            },
            set: function (value) {
                if (!sameValue(value, this[internalPropName])) {
                    var oldValue = this[internalPropName];
                    this[internalPropName] = value;
                    var notifier = Object.getNotifier(this);
                    notifier.notify({ type: 'updated', object: this, name: property, oldValue: oldValue });
                }
            },
            enumerable: true,
            configurable: true
        });
    }


    // call defineObservableProperty for each property name passed as 'rest argument'
    ObserveUtils.defineObservableProperties = function (target) {
        if (!isObject(target)) {
            throw new TypeError('target must be an Object, given ' + target);
        }
        var properties = Array.prototype.slice.call(arguments, 1);
        while (properties.length > 0) {
            var property = properties.shift(),
                descriptor = getPropertyDescriptor(target, property);

            if (!descriptor || !isAccessorDescriptor(descriptor)) {
                var originalValue = descriptor && descriptor.value;
                defineObservableProperty(target, property, originalValue);
            }
        }
        return target;
    };
})(this);