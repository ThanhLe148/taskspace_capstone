import Image from "next/image";
import Link from "next/link";

export const Logo = () => {
  return (
    <Link href="/" className="flex items-center gap-x-2">
      <Image
        src="/logo.png"
        alt="TaskSpace logo"
        height={32}
        width={32}
        style={{ height: 32, width: 32 }}
      />
      <span className="text-xl font-semibold text-neutral-700">
        TaskSpace
      </span>
    </Link>
  );
};

export default Logo;
