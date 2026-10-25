import localFont from "next/font/local";
import { Poppins } from "next/font/google";

import { cn } from "@/lib/utils";
import { requireUser } from "@/lib/auth";

const headingFont = localFont({
  src: "../../../public/fonts/font.woff2"
});

const textFont = Poppins({
  subsets: ["latin"],
  weight: [
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900"
  ],
});

const DashboardPage = async () => {
  const user = await requireUser();
  return (
    <div className="mt-3 flex items-center justify-center flex-col">
      <div className={cn(
        "flex items-center justify-center flex-col",
        headingFont.className,
      )}>
        <h1 className="text-3xl md:text-6xl text-center text-neutral-800 mb-6">
          Welcome to TaskSpace, {user.name}
        </h1>
      </div>

      <div className={cn(
        "text-sm md:text-xl text-neutral-400 mt-4 max-w-xs md:max-w-2xl text-center mx-auto",
        textFont.className,
      )}>
        You are signed in as {user.email}. Your account is ready — start organizing your work with TaskSpace.
      </div>
    </div>
  );
};

export default DashboardPage;
