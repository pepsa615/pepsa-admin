export const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Never';
export const formatMoney = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    value,
  );
export const titleCase = (value: string) =>
  value.toLowerCase().replace(/(^|[._-])\w/g, (match) => match.replace(/[._-]/, ' ').toUpperCase());
