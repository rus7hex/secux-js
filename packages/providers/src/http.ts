import { HttpConnection } from "@json-rpc-tools/provider";
import axios, { AxiosInstance } from "axios";


Reflect.defineProperty(HttpConnection.prototype, "register", {
    value: async function (url: string): Promise<AxiosInstance> {
        url = url || this.url;

        if (!isHttpUrl(url)) {
            throw new Error(`Provided URL is not compatible with HTTP connection: ${url}`);
        }
        if (this.registering) {
            return new Promise((resolve, reject) => {
                this.events.once("open", () => {
                    if (typeof this.api === "undefined") {
                        return reject(new Error("HTTP connection is missing or invalid"));
                    }
                    resolve(this.api);
                });
            });
        }
        this.url = url;
        this.registering = true;
        const api = axios.create({
            baseURL: url,
            timeout: 30_000, // 30 secs
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });
        this.onOpen(api);
        return api;
    },
    configurable: false
});

const HTTP_REGEX = "^https?:";
function isHttpUrl(url: string) {
    return matchRegexProtocol(url, HTTP_REGEX);
}

function getUrlProtocol(url: string): string | undefined {
    const matches = url.match(new RegExp(/^\w+:/, "gi"));
    if (!matches || !matches.length) return;
    return matches[0];
}

function matchRegexProtocol(url: string, regex: string): boolean {
    const protocol = getUrlProtocol(url);
    if (typeof protocol === "undefined") return false;
    return new RegExp(regex).test(protocol);
}