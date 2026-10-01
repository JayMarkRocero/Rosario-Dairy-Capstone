const light = {
  navy: "#17375E", blue: "#2F80ED", green: "#27AE60", orange: "#F39C12",
  red: "#EB5757", purple: "#9B59B6", teal: "#1ABC9C", bg: "#F5F7FA",
  white: "#FFFFFF", text: "#1A2332", muted: "#64748B", border: "rgba(0,0,0,0.08)",
  action: "#2F80ED", successAction: "#27AE60", dangerAction: "#C63F4A", warningAction: "#9A5A00", sidebar: "#17375E",
};

const dark = {
  navy: "#8DB8EC", blue: "#8CB9FF", green: "#73D8AC", orange: "#F5BE76",
  red: "#F0919A", purple: "#C6A8E8", teal: "#70D5C6", bg: "#0D1522",
  white: "#18263A", text: "#ECF2F9", muted: "#9FB1C6", border: "rgba(170,195,222,0.18)",
  action: "#3569A9", successAction: "#277758", dangerAction: "#A84859", warningAction: "#8A521A", sidebar: "#102940",
};

const color = (key: keyof typeof light) =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? dark[key] : light[key];

export const C = {
  get navy() { return color("navy"); },
  get blue() { return color("blue"); },
  get green() { return color("green"); },
  get orange() { return color("orange"); },
  get red() { return color("red"); },
  get purple() { return color("purple"); },
  get teal() { return color("teal"); },
  get bg() { return color("bg"); },
  get white() { return color("white"); },
  get text() { return color("text"); },
  get muted() { return color("muted"); },
  get border() { return color("border"); },
  get action() { return color("action"); },
  get successAction() { return color("successAction"); },
  get dangerAction() { return color("dangerAction"); },
  get warningAction() { return color("warningAction"); },
  get sidebar() { return color("sidebar"); },
};
