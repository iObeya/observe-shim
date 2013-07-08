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

    //use setImmediate if available
    var setImmediate = global.setImmediate || global.msSetImmediate;
    var clearImmediate = global.clearImmediate || global.msClearImmediate;
    if (!setImmediate) {
        // fallback on setTimeout if not
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
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#observercallbacks)
    var observerCallbacks = [];

    // This object is used as the prototype of all the notifiers that are returned by Object.getNotifier(O).
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#notifierprototype)
    var NotifierPrototype = Object.create(Object.prototype);
    Object.defineProperty(NotifierPrototype, 'notify', {
        value: function (changeRecord) {
            var notifier = this;
            if (Object(notifier) !== notifier) {
                throw new TypeError('this must be an Object, given ' + notifier);
            }
            if (Object(notifier) !== notifier) {
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
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#getnotifier)
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
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#enqueuechangerecord)
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

    // Remove reference all reference to an observer callback,
    // if this one is not used anymore.
    // In the proposal the ObserverCallBack has a weak reference over observers,
    // Without this possibility we need to clean this list to avoid memory leak
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
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#deliverchangerecords)
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
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#deliverallchangerecords)
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
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.observe)
    Object.observe = function (target, observer) {
        if (Object(target) !== target) {
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
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.unobseve)
    Object.unobserve = function (target, observer) {
        if (Object(target) !== target) {
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
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.deliverchangerecords)
    Object.deliverChangeRecords = function (observer) {
        if (typeof observer !== 'function') {
            throw new TypeError('callback must be a function, given ' + observer);
        }
        while (deliverChangeRecords(observer)) {}
        return;
    };

    // Implementation of the public api 'Object.getNotifier'
    // described in the proposal.
    // [Corresponding Section in ecma script wiki](http://wiki.ecmascript.org/doku.php?id=harmony:observe#object.getnotifier)
    Object.getNotifier = function (target) {
        if (Object(target) !== target) {
            throw new TypeError('target must be an Object, given ' + target);
        }
        return getNotifier(target);
    };


})(typeof global !== 'undefined' ? global : this);


