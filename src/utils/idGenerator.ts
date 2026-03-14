import { customAlphabet } from "nanoid";

export const customNanoId = () => {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const nanoid = customAlphabet(alphabet, 20);
  return nanoid();
};
