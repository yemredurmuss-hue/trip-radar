// Web build entry (node scripts/build.mjs --web → dist-web/): the board and its worker in one page, on localhost.
// Order matters: the shim defines `chrome` before the worker and the board load.
import { startWorker } from "./chromeShim";
import "../background";
import "../app/main";

startWorker();
