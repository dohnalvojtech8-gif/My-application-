import {
  siNetflix,
  siSpotify,
  siApple,
  siGoogle,
  siPaypal,
} from "simple-icons";
const brands: any = {
  netflix: siNetflix,
  spotify: siSpotify,
  apple: siApple,
  google: siGoogle,
  paypal: siPaypal,
};
export function ItemIcon({ item }: { item: any }) {
  const b = brands[item.appearance?.brand];
  return item.appearance?.logo ? (
    <img src={item.appearance.logo} alt="" width={30} height={30} />
  ) : b ? (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={"#" + b.hex}
      aria-hidden="true"
    >
      <path d={b.path} />
    </svg>
  ) : (
    <span aria-hidden="true">{item.appearance?.icon || "◈"}</span>
  );
}
