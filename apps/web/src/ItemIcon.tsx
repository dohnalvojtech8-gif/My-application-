import { icons } from "./icons";
export function ItemIcon({ item }: { item: any }) {
  const a = item.appearance || {};
  const Icon = icons[a.icon as keyof typeof icons] || icons.Wallet;
  return a.logo ? (
    <img src={a.logo} alt="" width={30} height={30} />
  ) : a.brand ? (
    <img
      src={"/api/brands/" + encodeURIComponent(a.brand) + "/icon"}
      alt=""
      width={30}
      height={30}
    />
  ) : (
    <Icon
      size={26}
      strokeWidth={1.7}
      style={{ color: a.iconColor || item.color }}
      aria-hidden="true"
    />
  );
}
