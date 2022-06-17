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


let __logger: any;

switch (process.env.LOGGER) {
    case "winston":
        require("setimmediate");
        const winston = require("winston");

        __logger = winston.createLogger({
            transports: [
                new winston.transports.Console({
                    level: (process.env.DISTRIBUTION === "development") ? "debug" : "warn",
                    format: winston.format.combine(
                        winston.format.colorize({ all: true }),
                        //@ts-ignore
                        winston.format.printf(({ level, message, id }) => `[${level}] {${id}} \n${message}`)
                    )
                })
            ]
        });
        break;

    case "react-native-logs":
        const rnLogs = require("react-native-logs");

        const config = {
            severity: (process.env.DISTRIBUTION === "development") ? "debug" : "warn",
            transport: rnLogs.consoleTransport,
            transportOptions: {
                colors: "ansi",
            },
            async: true,
            //dateFormat: "time",
            printLevel: true,
            printDate: false,
            enabled: true,
        };

        __logger = rnLogs.logger.createLogger(config);
        __logger.child = (arg: any) => {
            const logger = __logger.extend(arg.id);
            __logger.enable(arg.id);

            return logger;
        }
        break;
}

Object.defineProperty(process.env, "SECUX_LOGGER", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: __logger
});
