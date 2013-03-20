/*global describe, it, expect , beforeEach, afterEach, sinon*/

describe('Observe.observe harmony proposal shim', function () {
    'use strict';

    describe('Object.observe', function () {
        it("should throw an error when passing an non object at first parameter", function () {
            expect(function () {
                Object.observe(5, function () {  });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.observe("g", function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.observe(function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.observe(NaN, function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.observe(null, function () {  });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.observe(undefined, function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });

        it("should throw and error when second parameter is not callable", function () {
            expect(function () {
                Object.observe({}, {});
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });

        it("should throw and error when second parameter is frozen", function () {
            var observer = function () {
            };
            Object.freeze(observer)
            expect(function () {
                Object.observe({}, observer);
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });
    });

    describe('Object.unobserve', function () {
        it("should throw an error when passing an non object at first parameter", function () {
            expect(function () {
                Object.unobserve(5, function () {
                });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve("g", function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve(function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve(NaN, function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve(null, function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve(undefined, function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });

        it("should throw and error when second parameter is not callable", function () {
            expect(function () {
                Object.unobserve({}, {});
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });
    });

    describe('Object.getNotifier', function () {
        it("should throw an error when passing an non object at first parameter", function () {
            expect(function () {
                Object.getNotifier(5);
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.getNotifier("g");
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.getNotifier(function () {  });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.getNotifier(NaN);
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.getNotifier(null);
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.getNotifier(undefined);
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });



        it("should return a notifier with a 'notify' function,  configurable, writable and not enumerable  ", function () {
            var notifier = Object.getNotifier({}),
                notifyDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(notifier), 'notify');

            expect(notifyDesc).to.be.ok();
            expect(notifyDesc.value).to.be.a("function");
            expect(notifyDesc.configurable).to.be.ok();
            expect(notifyDesc.writable).to.be.ok();
            expect(notifyDesc.enumerable).not.to.be.ok();
        });


        it("should return a unique notifier for a given object", function () {
            var obj = {},
                notifier = Object.getNotifier(obj),
                notifier1 = Object.getNotifier(obj);

            expect(notifier).to.be.equal(notifier1);
        });
    });

    describe('Object.deliverChangeRecords', function () {
        it("should throw an error when passing an non object at first parameter", function () {
            expect(function () {
                Object.unobserve(5, function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve("g", function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve(function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve(NaN, function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve(null, function () { });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.unobserve(undefined, function () {  });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });

        it("should throw and error when second parameter is not callable", function () {
            expect(function () {
                Object.unobserve({}, {});
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });
    });


    describe('Notifier.notify', function () {

        var notifier = Object.getNotifier({});

        it("should throw an error when passing an non-object as parameter", function () {
            expect(function () {
                notifier.notify(5);
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });


        it("should throw an error when the property type of the first parameter is not a string", function () {
            expect(function () {
                notifier.notify({ type: 4 });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });


    });

    describe("Changes  delivery", function () {
        var obj, notifier, observer;

        beforeEach(function () {
            obj = {};
            observer = sinon.spy();
            Object.observe(obj, observer);
            notifier = Object.getNotifier(obj);
        });

        afterEach(function () {
            Object.unobserve(obj, observer);
            obj = observer = notifier = null;
        });


        function getDeliveredRecords(){
            return observer.args[0][0];
        }


        it("should call the observer when a change record is delivered", function () {
            notifier.notify({
                type: 'updated',
                name: 'foo'
            });

            Object.deliverChangeRecords(observer);
            expect(observer.calledOnce).to.be.ok();
        });


        it("should call the observer only one time when multiples changes records are delivered", function () {
            notifier.notify({
                type: 'updated',
                name: 'foo'
            });
            notifier.notify({
                type: 'updated',
                name: 'foo'
            });

            Object.deliverChangeRecords(observer);
            expect(observer.calledOnce).to.be.ok();
        });


        it("should call the observer only one time when multiples changes records are delivered", function () {
            notifier.notify({
                type: 'updated'
            });
            notifier.notify({
                type: 'updated'
            });

            Object.deliverChangeRecords(observer);
            expect(observer.calledOnce).to.be.ok();
        });


        it("should deliver a change  record  with a property 'object' corresponding to the observed object", function () {
            notifier.notify({
                type: 'updated'
            });
            Object.deliverChangeRecords(observer);
            var deliveredRecord = getDeliveredRecords()[0];
            expect(deliveredRecord).to.have.property('object', obj);
        });

        it("should ignore an object property  specified in the original change record", function () {
            notifier.notify({
                type: 'updated',
                object : 'foo'
            });
            Object.deliverChangeRecords(observer);
            var deliveredRecord = getDeliveredRecords()[0];
            expect(deliveredRecord).to.have.property('object', obj);
        });

        it("should deliver a change record with all other property equals to the original one", function () {
            notifier.notify({
                type: 'updated',
                foo : 1,
                bar : 2
            });
            Object.deliverChangeRecords(observer);
            var deliveredRecord = getDeliveredRecords()[0];
            expect(deliveredRecord).to.have.property('foo', 1);
            expect(deliveredRecord).to.have.property('bar', 2);
        });

        it("should call the observer function only once time even in case of multiple observation", function () {
            Object.observe(obj, observer);
            notifier.notify({
                type: 'updated',
                name: 'foo'
            });

            Object.deliverChangeRecords(observer);
            expect(observer.calledOnce).to.be.ok();
        });

        it("should not call a function that has not been used for an observation", function () {
            var observer2 = sinon.spy();
            notifier.notify({
                type: 'updated',
                name: 'foo'
            });
            Object.deliverChangeRecords(observer2);
            expect(observer2.called).not.to.be.ok();
        });

        it("should not call the observer after call to Object.unobserve", function () {
            Object.unobserve(obj, observer);
            notifier.notify({
                type: 'updated',
                name: 'foo'
            });
            Object.deliverChangeRecords(observer);
            expect(observer.called).not.to.be.ok();
        });

        it("should not deliver change records between an unobservation and a reobservation", function () {
            Object.unobserve(obj, observer);
            notifier.notify({
                type: 'updated',
                name: 'foo'
            });
            Object.observe(obj, observer);
            notifier.notify({
                type: 'updated',
                name: 'foo'
            });
            Object.deliverChangeRecords(observer);
            expect(getDeliveredRecords()).to.have.length(1);
        });


        it("should deliver records in the order of notification", function () {
            notifier.notify({
                type: 'updated',
                order: 0
            });

            notifier.notify({
                type: 'updated',
                order: 1
            });

            notifier.notify({
                type: 'updated',
                order: 2
            });

            Object.deliverChangeRecords(observer);

            var changeRecords = getDeliveredRecords();
            expect(changeRecords[0]).to.have.property('order', 0);
            expect(changeRecords[1]).to.have.property('order', 1);
            expect(changeRecords[2]).to.have.property('order', 2);
        });


        it("should deliver change records asynchronously without a call to Object.deliverChangeRecords", function (done) {
            this.timeout(100);
            Object.observe(obj, function () {
                done();
            });
            notifier.notify({
                type: 'updated'
            });
        });


        it("should deliver change records in the order of observation", function (done) {
            this.timeout(100);
            var obj2 = {},
                notifier2 = Object.getNotifier(obj2),
                observer2 = sinon.spy(function () {
                    expect(observer.called).to.be.ok();
                });

            Object.observe(obj2, observer2);

            Object.observe(obj, function () {
                expect(observer2.called).to.be.ok();
                done();
            });

            notifier.notify({
                type: 'updated'
            });

            notifier2.notify({
                type: 'updated'
            });
        });


    });
});