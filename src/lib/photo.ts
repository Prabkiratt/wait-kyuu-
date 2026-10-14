/** Resize Unsplash URLs on the fly; leave other URLs untouched. Safe to import from server and client code. */
export const photo = (u: string | undefined, w = 800) =>
  !u ? undefined : u.includes("images.unsplash.com") ? `${u.split("?")[0]}?auto=format&fit=crop&w=${w}&q=72` : u;
