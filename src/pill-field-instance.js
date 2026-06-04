// Single shared PillField — ONE WebGL context for every card pill.
// The prototype created this on `window` via an importmap module script; here it
// is a normal singleton module that every PooledPill imports directly.
import { PillField } from "./pill-field.js";

export const pillField = new PillField();
