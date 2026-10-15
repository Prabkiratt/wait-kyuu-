/** Calendar-day key in the business's timezone, used to restart ticket numbering each day. */
export const dayKey = (at: number, tzOffsetMin: number) => new Date(at + tzOffsetMin * 60000).toISOString().slice(0, 10);
