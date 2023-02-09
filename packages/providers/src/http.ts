/*!
Copyright 2023 SecuX Technology Inc
Copyright Wu Tsung-Yu

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


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