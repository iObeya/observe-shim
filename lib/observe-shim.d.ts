
interface INotification {
    type: notifyType;
    object: Object;
    name: string;
}

interface IUpdateNotification extends INotification {
    oldValue: any;
}

declare enum notifyType {
    "new",
    "updated",
    "deleted", 
    "splice"
} 

interface INotifierPrototype {
    notify(o: any);       
}

interface Object {
    observe(o: Object, callback: any);
    observe(o: Object, callback: any, accept: notifyType[]);
    unobserve(o: Object, callback: any);
    deliverChangeRecords(callback: any);
    getNotifier(o: Object): INotifierPrototype;
}

declare var Object: {
    observe(o: Object, callback: any);
    observe(o: Object, callback: any, accept: notifyType[]);
    unobserve(o: Object, callback: any);
    deliverChangeRecords(callback: any);
    getNotifier(o: Object): INotifierPrototype;
}
