/** Change type  */
declare enum notifyType {
    "new",
    "updated",
    "deleted",
    "splice"
} 

/** Notification object */
interface Notification {
    type: string;
    object: any;
    name: string;
}

/** Update notification object */
interface UpdateNotification extends Notification {
    oldValue: any;
}

/** Signature of notification callback */
interface ObserverCallback {
    (changes: Notification[]): void;
}

/** Signature of Notifier object */
interface INotifier {
    notify(changeRecord: Notification): void;
    performChange(changeType: notifyType, changeFn: ObserverCallback ): void;       
}

/** Extension to Object interface */
interface Object {
    observe(o: Object, callback: ObserverCallback);
    observe(o: Object, callback: ObserverCallback, accept: notifyType[]);
    unobserve(o: Object, callback: ObserverCallback);
    deliverChangeRecords(callback: ObserverCallback);
    getNotifier(o: Object): INotifier;
}

/** Extension to Array interface */
interface Array {
    observe(o: Object, callback: ObserverCallback);
    observe(o: Object, callback: ObserverCallback, accept: notifyType[]);
    unobserve(o: Object, callback: ObserverCallback);
    deliverChangeRecords(callback: ObserverCallback);
    getNotifier(o: Object): INotifier;
}
