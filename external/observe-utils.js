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

// ObjectUtils
// ===========

(function (global) {
    'use strict';

    /**
     * @namespace
     */
    var ObserveUtils;
    //since we do not support node, is it really necessary ?
    if (typeof exports !== 'undefined') {
        ObserveUtils = exports;
    } else {
        ObserveUtils = global.ObserveUtils = {};
    }

    // Utilities
    // ---------


    // borrowing some array methods
    var slice = Function.call.bind(Array.prototype.slice),
        map = Function.call.bind(Array.prototype.map);

    // return true if the given property descriptor contains accessor
    function isAccessorDescriptor(desc) {
        if (typeof desc === 'undefined') {
            return false;
        }
        return ('get' in desc || 'set' in desc);
    }



    // getPropertyDescriptor shim
    // copied from [es6-shim](https://github.com/paulmillr/es6-shim)
    function getPropertyDescriptor(target, name) {
        var pd = Object.getOwnPropertyDescriptor(target, name),
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
    // copied from [the ecmascript wiki](http://wiki.ecmascript.org/doku.php?id=harmony:egal)
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

    // cast a value as number, and test if the obtained result
    // is a positive finite integer, throw an error otherwise
    function isPositiveFiniteInteger(value, errorMessage) {
        value = Number(value);
        if (isNaN(value) || !isFinite(value) || value < 0 || value % 1 !== 0) {
            throw new RangeError(errorMessage.replace('$', value));
        }
        return value;
    }

    // defineObservableProperties Implementation
    // ------------------------------------------

    // Uid generation helper
    var uidCounter = 0;

    // Define a property on an object that will call the Notifier.notify method when updated
    function defineObservableProperty(target, property, originalValue) {

        //we store the value in an non-enumerable property with generated unique name
        var internalPropName = '_' + (uidCounter++) + property;

        Object.defineProperty(target, internalPropName, {
            value: originalValue,
            writable: true,
            enumerable: false,
            configurable: true
        });

        //then we create accessor method for our 'hidden' property,
        // that dispatch changesRecords when the value is updated
        Object.defineProperty(target, property, {
            get: function () {
                return this[internalPropName];
            },
            set: function (value) {
                if (!sameValue(value, this[internalPropName])) {
                    var oldValue = this[internalPropName];
                    Object.defineProperty(target, internalPropName, {
                        value: value,
                        writable: true,
                        enumerable: false,
                        configurable: true
                    });
                    var notifier = Object.getNotifier(this);
                    notifier.notify({ type: 'updated', name: property, oldValue: oldValue });
                }
            },
            enumerable: true,
            configurable: true
        });
    }


    // call defineObservableProperty for each property name passed as 'rest argument'

    /**
     * Define observable properties on the given object an return it.
     *
     * @param {Object} target
     * @param {...string} properties
     * @returns {Object}
     */
    ObserveUtils.defineObservableProperties = function (target, properties) {
        if (!isObject(target)) {
            throw new TypeError('target must be an Object, given ' + target);
        }
        properties = slice(arguments, 1);
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



    // List Implementation
    // ------------------------------------------

    /**
     *
     * @param length
     * @returns {*}
     * @constructor
     * @function
     */
    function List(length) {
        if (arguments.length === 0) {
            length = 0;
        }

        // in this case we create a list with a given length
        if (arguments.length <= 1 && typeof length === 'number') {
            if (this instanceof List) {
                this.length = length;
            }
            else {
                return new List(length);
            }
        }
        else {
            //here we create a list with initial values
            if (!(this instanceof List)) {
                return List.fromArray(slice(arguments));
            }
            else {
                for (var i = 0, l = arguments.length ; i < l ; i++) {
                    this[i] = arguments[i];
                }
                this.length = arguments.length;
            }
        }
    }

    /**
     * Create a list from a given array
     * @param array
     * @returns {List}
     */
    List.fromArray = function (array) {
        if (!Array.isArray(array)) {
            throw new Error();
        }

        var list = new List();
        for (var i = 0, l = array.length ; i < l ; i++) {
            list[i] = array[i];
        }
        list.length = array.length;
        return list;
    };

    Object.defineProperties(List.prototype, {
        /**
         * hidden value holder for the length property
         * @private
         */
        '_length' : {
            value : 0,
            enumerable: false,
            configurable: true,
            writable: true
        },
        /**
         * the length of the list
         * @property {number} length
         */
        'length' : {
            get : function () {
                return this._length;
            },
            set : function (value) {
                value = isPositiveFiniteInteger(value, 'Invalid  list length : $');
                if (value !== this._length) {
                    var oldValue = this._length;
                    Object.defineProperty(this, '_length', {
                        value : value,
                        enumerable: false,
                        configurable: true,
                        writable: true
                    });

                    if (oldValue > value) {
                        //delete values if the length have been decreased
                        for (var i = value; i < oldValue; i++) {
                            this["delete"](i);
                        }
                    }
                    var notifier = Object.getNotifier(this);
                    notifier.notify({ type: 'updated', name: 'length', oldValue: oldValue });
                }
            },
            enumerable: true,
            configurable : true
        }
    });

    /**
     * Returns an Array copy of the list
     * @returns {Array}
     */
    List.prototype.toArray = function () {
        return slice(this);
    };

    /**
     * set the givent value at the specified index.
     * @param {number} index
     * @param {*} value
     * @return {*}
     */
    List.prototype.set = function (index, value) {
        index = isPositiveFiniteInteger(index, 'Invalid index : $');


        var notifier = Object.getNotifier(this);
        if (index >= this.length) {
            this[index] = value;
            notifier.notify({ type: 'new', name: index});
            this.length = index + 1;
        }
        else if (!sameValue(value, this[index])) {
            var oldValue = this[index];
            this[index] = value;
            notifier.notify({ type: 'updated', name: index, oldValue: oldValue });
        }
        return value;
    };

    /**
     * delete the value at the specified index.
     * @param {number} index
     * @return {boolean}
     */
    List.prototype["delete"] = function (index) {
        index = isPositiveFiniteInteger(index, 'Invalid index : $');
        if (this.hasOwnProperty(index)) {
            var oldValue = this[index];
            if (delete this[index]) {
                var notifier = Object.getNotifier(this);
                notifier.notify({ type: 'deleted', name: index, oldValue: oldValue });
                return true;
            }
        }
        return false;
    };

    /**
     * create a new list resulting of the concatenation of all the List and array
     * passed as parameter with the addition of other values passed as parameter
     * @param {...*} args
     * @return {List}
     */
    List.prototype.concat = function (args) {
        args = map(arguments, function (item) {
            return (item instanceof List) ?  item.toArray() : item;
        });
        return List.fromArray(Array.prototype.concat.apply(this.toArray(), args));
    };

    /**
     * Joins all elements of a List into a string.
     * @param {string} [separator]
     * @return {string}
     */
    List.prototype.join = function (separator) {
        return this.toArray().join(separator);
    };

    /**
     * Removes the last element from a List and returns that element.
     * @return {*}
     */
    List.prototype.pop = function () {
        if (this.length === 0) {
            return void(0);
        }
        var value = this[this.length - 1];
        this.length--;
        return value;
    };

    /**
     * Mutates a List by appending the given elements and returning the new length of the array.
     * @param {...*} items
     * @return {number}
     */
    List.prototype.push = function () {
        if (arguments.length > 0) {
            var argumentsLength = arguments.length,
                length = this.length,
                notifier = Object.getNotifier(this),
                i, index;

            for (i = 0; i < argumentsLength; i++) {
                index =  length + i;
                // avoid the usage of the set function and manually
                // set the value and notify the changes to avoid the notification of
                // multiple length modification
                this[index] = arguments[i];
                notifier.notify({
                    type : 'new',
                    name : index
                });
            }

            this.length += arguments.length;
        }
        return this.length;
    };

    /**
     * Reverses a List in place.  The first List element becomes the last and the last becomes the first.
     * @return {List}
     */
    List.prototype.reverse = function () {
        var arr = this.toArray().reverse();
        for (var i = 0, l = arr.length; i < l; i++) {
            this.set(i, arr[i]);
        }
        return this;
    };

    /**
     * Removes the first element from a List and returns that element. This method changes the length of the List.
     * @return {*}
     */
    List.prototype.shift = function () {
        if (this.length === 0) {
            return void(0);
        }
        var arr = this.toArray();
        var value = arr.shift();
        for (var i = 0, l = arr.length; i < l; i++) {
            this.set(i, arr[i]);
        }
        this.length--;
        return value;
    };

    /**
     * Returns a shallow copy of a portion of an List.
     * @param {number} [start]
     * @param {number} [end]
     * @return {List}
     */
    List.prototype.slice = function (start, end) {
        return List.fromArray(this.toArray().slice(start, end));
    };

    /**
     * Sorts the elements of a List in place and returns the List.
     * @param {function} [compareFn]
     * @return {List}
     */
    List.prototype.sort = function (compareFn) {
        var arr = this.toArray().sort(compareFn);
        for (var i = 0, l = arr.length; i < l; i++) {
            this.set(i, arr[i]);
        }
        return this;
    };

    /**
     * Changes the content of a List, adding new elements while removing old elements.
     * @return {List}
     */
    List.prototype.splice = function () {
        var returnValue = [];
        if (arguments.length > 0) {
            var arr = this.toArray(),
                notifier = Object.getNotifier(this),
                length = this.length;
            returnValue = Array.prototype.splice.apply(arr, arguments);

            for (var i = 0, l = arr.length; i < l; i++) {
                var oldValue = this[i];
                if (oldValue !== arr[i]) {
                    // avoid the usage of the set function and manually
                    // set the value and notify the changes to avoid the notification of
                    // multiple length modification
                    this[i] = arr[i];
                    if (!sameValue(oldValue, this[i])) {
                        notifier.notify(
                            i >= length ?
                            {type : 'new', name : i}:
                            {type : 'updated', name : i, oldValue : oldValue}
                        );
                    }
                }
            }

            this.length = arr.length;
        }
        return List.fromArray(returnValue);
    };

    /**
     * Adds one or more elements to the beginning of a List and returns the new length of the List.
     * @return {number}
     */
    List.prototype.unshift = function () {
        if (arguments.length > 0) {
            var arr = this.toArray(),
                notifier = Object.getNotifier(this),
                length = this.length;

            Array.prototype.unshift.apply(arr, arguments);
            for (var i = 0, l = arr.length; i < l; i++)  {
                var oldValue = this[i];
                // avoid the usage of the set function and manually
                // set the value and notify the changes to avoid the notification of
                // multiple length modification
                this[i] = arr[i];
                if (!sameValue(oldValue, this[i])) {
                    notifier.notify(
                        i >= length ?
                        {type : 'new', name : i}:
                        {type : 'updated', name : i, oldValue : oldValue}
                    );
                }
            }

            this.length = arr.length;
        }
        return this.length;
    };

    /**
     * Apply a function against an accumulator and each value of the List (from left-to-right) as to reduce it to a single value.
     * @param {function} callback
     * @param {Object} [initialValue]
     * @return {Object}
     */
    List.prototype.reduce =  Array.prototype.reduce;

    /**
     * Apply a function simultaneously against two values of the array (from right-to-left) as to reduce it to a single value.
     * @param {function} callback
     * @param {Object} [initialValue]
     * @return {Object}
     */
    List.prototype.reduceRight =  Array.prototype.reduceRight;

    /**
     * Returns the first index at which a given element can be found in the List, or -1 if it is not present.
     * @param {Object} searchElement
     * @param {number} [fromIndex]
     * @return {number}
     */
    List.prototype.indexOf =  Array.prototype.indexOf;

    /**
     * Returns the last index at which a given element can be found in the List, or -1 if it is not present. The List is searched backwards, starting at fromIndex.
     * @param {Object} searchElement
     * @param {number} [fromIndex]
     * @return {number}
     */
    List.prototype.lastIndexOf = Array.prototype.lastIndexOf;

    /**
     * Tests whether all elements in the List pass the test implemented by the provided function.
     * @param {function} callback
     * @param {Object} [thisObject]
     * @return {boolean}
     */
    List.prototype.every = Array.prototype.every;

    /**
     * Creates a new List with all elements that pass the test implemented by the provided function
     * @param {function} callback
     * @param {Object} [thisObject]
     * @return {List}
     */
    List.prototype.filter = function (callback, thisObject) {
        return List.fromArray(this.toArray().filter(callback, thisObject));
    };

    /**
     * Executes a provided function once per List element.
     * @param {function} callback
     * @param {Object} [thisObject]
     * @return {void}
     */
    List.prototype.forEach = Array.prototype.forEach;

    /**
     * Creates a new List with the results of calling a provided function on every element in this List.
     * @param {function} callback
     * @param {Object} [thisObject]
     * @return {List}
     */
    List.prototype.map = function (callback, thisObject) {
        return List.fromArray(this.toArray().map(callback, thisObject));
    };

    /**
     * Tests whether some element in the List passes the test implemented by the provided function.
     * @param {function} callback
     * @param {Object} [thisObject]
     * @return {boolean}
     */
    List.prototype.some = Array.prototype.some;

    ObserveUtils.List = List;

})(this);