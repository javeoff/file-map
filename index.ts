import { writeFileSync, readFileSync, existsSync } from "node:fs";

export default class FileMap extends Map<string, string> {
  public constructor(
    name: string,
    entries?: ReadonlyArray<[string, string]> | null,
  ) {
    if (!existsSync(name)) {
      writeFileSync(name, "{}");
    }
    if (existsSync(name)) {
      const data: Record<string, string> = JSON.parse(
        readFileSync(name).toString(),
      );
      super(Object.entries(data) as ReadonlyArray<[string, string]>);
      super.set("fileName", name);
      return;
    }

    super(entries);
    super.set("fileName", name as string);
  }

  public set(key: string, value: string): this {
    super.set(key, value);

    writeFileSync(
      super.get("fileName") as string,
      JSON.stringify(Object.fromEntries(super.entries()), undefined, 2),
    );

    return this;
  }
}
