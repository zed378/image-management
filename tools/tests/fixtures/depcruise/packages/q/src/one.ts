// no-circular
import { two } from "./two";

export const one = () => two();
