import ExpiryMap from "expiry-map";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

// @ts-ignore
export class FileMap {
	private map: ExpiryMap<string, any>;
	private dirtyKeys: Set<string> = new Set();
	private fileCache: Record<string, any> = {};
	private intervalId?: NodeJS.Timeout;

	public constructor(
		private name: string,
		entries?: ReadonlyArray<[string, any]> | null,
		interval: number = 10000,
		private maxMemoryKeys: number = 100,
		maxAge = 1000 * 60 * 60 * 6,
	) {
		this.map = new ExpiryMap(maxAge, entries);
		try {

		if (existsSync(name)) {
			const content = readFileSync(name, "utf-8");
			if (content) {
				this.fileCache = JSON.parse(content);
				Object.entries(this.fileCache).forEach(([key, value]) =>
					this.map.set(key, value)
				);
				console.log("Loading file...", name);
			}
		} else {
			writeFileSync(name, "{}");
			this.fileCache = {};
		}

		this.intervalId = setInterval(() => this.writeToFile(), interval);
		} catch {
			writeFileSync(name, "{}");
			return this.constructor(name, entries, interval, maxMemoryKeys);
		}
	}

	public set(key: string, value: any): this {
		if (this.map.size >= this.maxMemoryKeys) {
			const oldestKey = this.map.keys().next().value;
			this.map.delete(oldestKey!);
		}

		this.map.set(key, value);
		this.dirtyKeys.add(key);
		return this;
	}

	public get(key: string): any | undefined {
		return this.map.has(key) ? this.map.get(key) : this.fileCache[key];
	}

	public delete(key: string): boolean {
		const deletedFromMemory = this.map.delete(key);

		if (key in this.fileCache) {
			delete this.fileCache[key];
			this.dirtyKeys.add(key);
		}

		return deletedFromMemory;
	}

	public clear(): void {
		this.map.clear();
		this.fileCache = {};
		this.dirtyKeys.clear();
	}

	private writeToFile() {
		if (this.dirtyKeys.size > 0) {
			const fileData: Record<string, any> = { ...this.fileCache };

			for (const key of this.dirtyKeys) {
				if (this.map.has(key)) {
					fileData[key] = this.map.get(key);
				}
			}

			console.log("Saving file...", this.name);
			writeFileSync(this.name, JSON.stringify(fileData, undefined, 2));
			this.dirtyKeys.clear();
			this.fileCache = fileData;
		}
	}

	public stopAutoSave() {
		clearInterval(this.intervalId);
		this.writeToFile();
	}

	public entries() {
		return new Map([
			...this.map.entries(),
			...Object.entries(this.fileCache).filter(([key]) => !this.map.has(key)),
		]).entries();
	}

	public keys(): IterableIterator<string> {
		return new Set([...this.map.keys(), ...Object.keys(this.fileCache)]).values();
	}

	public values(): IterableIterator<any> {
		const keys = new Set([...this.map.keys(), ...Object.keys(this.fileCache)]);

		const self = this;

		return (function* () {
			for (const key of keys) {
				yield self.map.has(key) ? self.map.get(key) : self.fileCache[key];
			}
		})();
	}


	public forEach(
		callbackfn: (value: any, key: string, map: Map<string, any>) => void,
		thisArg?: any
	): void {
		const allEntries = [
			...this.map.entries(),
			...Object.entries(this.fileCache).filter(([key]) => !this.map.has(key)),
		];
		allEntries.forEach(([key, value]) => callbackfn.call(thisArg, value, key, this));
	}

	[Symbol.iterator](): IterableIterator<[string, any]> {
		return this.entries();
	}

	[Symbol.toStringTag]: string = "Map";

	public has(key: string): boolean {
		return this.map.has(key) || key in this.fileCache;
	}

	public get size(): number {
		return this.map.size + Object.keys(this.fileCache).length;
	}
}

export default FileMap;
