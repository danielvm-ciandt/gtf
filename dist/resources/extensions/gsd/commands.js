export { registerGSDCommand } from "./commands/index.js";
export async function handleGSDCommand(...args) {
    const { handleGSDCommand: dispatch } = await import("./commands/dispatcher.js");
    return dispatch(...args);
}
export async function fireStatusViaCommand(...args) {
    const { fireStatusViaCommand: fireStatus } = await import("./commands/handlers/core.js");
    return fireStatus(...args);
}
