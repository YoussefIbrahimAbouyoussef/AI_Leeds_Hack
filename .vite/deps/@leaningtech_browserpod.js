//#region node_modules/@leaningtech/browserpod/index.js
var version = "2.3.4";
var dynImport = new Function("x", "return import(x)");
async function loadLibrary() {
	try {
		return await dynImport(`https://rt.browserpod.io/${version}/browserpod.js`);
	} catch (e) {
		return { BrowserPod: null };
	}
}
var BrowserPod = (await loadLibrary()).BrowserPod;
//#endregion
export { BrowserPod };

//# sourceMappingURL=@leaningtech_browserpod.js.map