/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
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


const JSZip = require("jszip-sync");
import { Logger } from "@secux/utility";
const logger = Logger?.child({ id: "dfu" });


export class Package {
    #zipFile: any;
    #manifest: any;

    constructor(zip: any, manifest: any) {
        this.#zipFile = zip;
        this.#manifest = manifest;
    }

    static async load(data: Uint8Array): Promise<Package> {
        const zip = await JSZip.loadAsync(data);

        try {
            const manifest = await zip.file("manifest.json")!.async("string");

            return new Package(zip, JSON.parse(manifest).manifest);
        }
        catch (e) {
            throw Error("Unable to find manifest, is this a proper DFU package?");
        }
    }

    static loadSync(data: Uint8Array): Package {
        const zip = new JSZip();
        const pkg = zip.sync(() => {
            try {
                zip.loadAsync(data);
                let manifest = '';
                zip.file("manifest.json")!.async("string").then((x: any) => manifest = x);

                return new Package(zip, JSON.parse(manifest).manifest);
            }
            catch (e) {
                throw Error("Unable to find manifest, is this a proper DFU package?");
            }
        });

        return pkg;
    }

    async getBaseImage() {
        return await this.#getImage(["softdevice", "bootloader", "softdevice_bootloader"]);
    }

    getBaseImageSync(): any {
        return this.#getImageSync(["softdevice", "bootloader", "softdevice_bootloader"]);
    }

    async getAppImage() {
        return await this.#getImage(["application"]);
    }

    getAppImageSync(): any {
        return this.#getImageSync(["application"]);
    }

    async #getImage(types: Array<string>) {
        for (const type of types) {
            if (this.#manifest[type]) {
                const entry = this.#manifest[type];
                let result: any = {
                    type: type,
                    initFile: entry.dat_file,
                    imageFile: entry.bin_file
                };

                result.initData = await this.#zipFile.file(result.initFile)!.async("uint8array");
                result.imageData = await this.#zipFile.file(result.imageFile)!.async("uint8array");
                result.size = result.initData.length + result.imageData.length;

                logger?.debug(`initData size: ${result.initData.length}`);
                logger?.debug(`imageData size: ${result.imageData.length}`);

                return result;
            }
        }
    }

    #getImageSync(types: Array<string>) {
        for (const type of types) {
            if (this.#manifest[type]) {
                const entry = this.#manifest[type];
                let result: any = {
                    type: type,
                    initFile: entry.dat_file,
                    imageFile: entry.bin_file
                };

                this.#zipFile.sync(() => {
                    this.#zipFile.file(result.initFile)!.async("uint8array").then((x: any) => result.initData = x);
                    this.#zipFile.file(result.imageFile)!.async("uint8array").then((x: any) => result.imageData = x);
                });
                result.size = result.initData.length + result.imageData.length;

                logger?.debug(`initData size: ${result.initData.length}`);
                logger?.debug(`imageData size: ${result.imageData.length}`);

                return result;
            }
        }
    }
}