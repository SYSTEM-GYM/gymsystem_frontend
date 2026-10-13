import Image, { getImageProps } from "next/image";
import { Barlow_Condensed } from "next/font/google";
import { BrandRing } from "@/components/auth/AuthUI";
import { BRAND_LOGO_SRC } from "@/lib/brand";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const DESKTOP_MEDIA = "(min-width: 1024px)";
const DESKTOP_SIZES = "58vw";
const MOBILE_SIZES = "100vw";

/**
 * Shared shell for /login, /register and /forgot-password.
 *
 * < lg  : portrait photo full-bleed behind everything, green-to-black overlay,
 *         logo centered on top and a glass form card resting near the bottom.
 * >= lg : split screen — landscape photo on the left (headline + logo ring),
 *         form on a deep-forest panel on the right.
 *
 * A single <picture> handles both photos (art direction), so each device only
 * downloads the image it actually shows.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    alt: "",
    src: "/icons/full-shot-man-training-with-dumbbells.jpg",
    width: 2560,
    height: 1707,
    sizes: DESKTOP_SIZES,
  });
  const {
    props: { srcSet: mobileSrcSet, ...imgProps },
  } = getImageProps({
    alt: "",
    src: "/icons/man-training-with-dumbbells-full-shot.jpg",
    width: 1707,
    height: 2560,
    sizes: MOBILE_SIZES,
    loading: "eager",
    fetchPriority: "high",
  });

  return (
    <main
      className={`${display.variable} relative min-h-dvh bg-forest text-bone lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(28rem,1fr)]`}
    >
      {/* ── Photo: fixed backdrop on mobile, sticky left pane on desktop ── */}
      <div className="fixed inset-0 lg:sticky lg:inset-auto lg:top-0 lg:h-dvh">
        <picture>
          <source media={DESKTOP_MEDIA} srcSet={desktopSrcSet} sizes={DESKTOP_SIZES} />
          <img
            {...imgProps}
            alt=""
            srcSet={mobileSrcSet}
            className="absolute inset-0 h-full w-full object-cover object-[50%_35%] lg:object-[42%_50%]"
          />
        </picture>

        {/* Mobile overlay */}
        <div className="absolute inset-0 bg-linear-to-b from-green-900/80 to-black/90 lg:hidden" />

        {/* Desktop overlays: lift the headline corner, then melt into the form panel */}
        <div className="absolute inset-0 hidden lg:block bg-linear-to-tr from-forest via-forest/50 to-pine/10" />
        <div className="absolute inset-y-0 right-0 hidden w-48 lg:block bg-linear-to-r from-transparent to-forest" />

        {/* Desktop brand story */}
        <div className="relative hidden h-full flex-col justify-between p-12 xl:p-16 lg:flex">
          <Image
            src={BRAND_LOGO_SRC}
            alt="GYM CONNECT"
            width={1080}
            height={540}
            preload
            className="-my-8 -ml-2 h-auto w-60"
          />

          <div className="max-w-xl pb-2">
            <p className="font-display text-7xl xl:text-8xl font-bold leading-[0.88] tracking-tight text-bone">
              Cada série
              <br />
              conta.
            </p>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-bone/75">
              Treinos, acesso por QR Code e desafios com a sua equipe, no app da sua academia.
            </p>
          </div>
        </div>

        {/* Logo ring straddling the seam between photo and form */}
        <BrandRing className="pointer-events-none absolute right-0 top-1/2 hidden h-[82vh] max-h-208 w-auto aspect-square -translate-y-1/2 translate-x-1/2 opacity-90 lg:block mask-[linear-gradient(to_right,black_42%,transparent_66%)]" />
      </div>

      {/* ── Form column ── */}
      <div className="relative z-10 flex min-h-dvh flex-col lg:justify-center lg:bg-[radial-gradient(110%_70%_at_100%_0%,rgba(108,181,45,0.16),transparent_62%)] lg:px-14 xl:px-20">
        {/* Mobile logo */}
        <div className="flex justify-center pt-[max(2rem,env(safe-area-inset-top))] lg:hidden">
          <Image
            src={BRAND_LOGO_SRC}
            alt="GYM CONNECT"
            width={1080}
            height={540}
            className="-my-6 h-auto w-56"
          />
        </div>

        <div className="mt-auto px-4 pt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:m-0 lg:p-0">
          <div className="mx-auto w-full max-w-md rounded-[28px] border border-white/15 bg-white/[0.07] p-6 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8 lg:max-w-sm lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
