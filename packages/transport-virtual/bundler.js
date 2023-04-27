import { TextEncoder, TextDecoder } from "text-encoding";
export { SecuxVirtualTransport } from "./src/transport-virtual";


if (!global["TextEncoder"]) {
    Object.defineProperty(global, 'TextEncoder', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: Object.freeze(TextEncoder)
    });
}

if (!global["TextDecoder"]) {
    Object.defineProperty(global, 'TextDecoder', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: Object.freeze(TextDecoder)
    });
}