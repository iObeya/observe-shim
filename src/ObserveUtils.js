(function (global) {
    "use strict";

    var ObserveUtils;
    if (typeof exports !== "undefined") {
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
        return ("get" in desc || "set" in desc);
    }



    // getProperty descriptor
    // copied from http://wiki.ecmascript.org/doku.php?id=harmony:egal
    function getPropertyDescriptor(target, name) {
        var pd = Object.getOwnPropertyDescriptor(target, name), // calls getOwnPropertyDescriptor trap
            proto = Object.getPrototypeOf(target);
        while (typeof pd === "undefined" && proto !== null) {
            pd = Object.getOwnPropertyDescriptor(proto, name);
            proto = Object.getPrototypeOf(proto);
        }
        return pd;
    }

    // IsObject ES5 internal algorithm shim
    function isObject(obj) {
        return obj && typeof obj === "object";
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
        // isNaN("foo") => true
        return x !== x && y !== y;
    }

    // Implementation
    // ---------

    // Uid generation helper
    var uidCounter = 0;

    // Define a property on an object that will call the Notifier.notify method when updated
    function defineObservableProperty(target, property, originalValue) {
        var internalPropName = "_" + (uidCounter++) + property;

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
                    notifier.notify({ type: "updated", object: this, name: property, oldValue: oldValue });
                }
            },
            enumerable: true,
            configurable: true
        });
    }


    // call defineObservableProperty for each property name passed as 'rest argument'
    ObserveUtils.defineObservableProperties = function (target) {
        if (!isObject(target)) {
            throw new TypeError("target must be an Object, given " + target);
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