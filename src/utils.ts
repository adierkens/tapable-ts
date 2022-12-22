/**
 * Checks if `value` is equal to `check` if `check` is a string or in `check` if check is an Array
 *
 * @param value - the value being searched for
 * @param check - the values to check against
 * @returns `boolean`
 */
export function equalToOrIn(value: string, check: string | Array<string>) {
  if (Array.isArray(check)) {
    return check.includes(value);
  }

  return check === value;
}
