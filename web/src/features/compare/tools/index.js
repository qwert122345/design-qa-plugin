// 캔버스 도구 레지스트리. 새 도구는 여기 등록만. (§7)
import { eyedropper } from "./eyedropper.js";
import { ruler } from "./ruler.js";
import { annotation } from "./annotation.js";

export const TOOLS = [eyedropper, ruler, annotation];

export const getTool = (key) => TOOLS.find((t) => t.key === key) || null;
