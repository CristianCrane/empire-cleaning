import "@fontsource/roboto/latin-500.css";
import { GoogleLogo } from "./GoogleLogo.tsx";

// Google's own sign-in button, not ours: its branding guidelines fix the
// colours (light and dark), the "G" and Roboto Medium. Only the height is
// ours, a touch target like every other button.
export function GoogleButton({ onPress }: { onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="inline-flex min-h-touch w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-[light-dark(#747775,#8e918f)] bg-[light-dark(#ffffff,#131314)] px-3 font-['Roboto',sans-serif] text-sm font-medium tracking-[0.25px] text-[light-dark(#1f1f1f,#e3e3e3)] outline-offset-2 hover:bg-[light-dark(#f8f8f8,#1f1f20)] focus-visible:outline-2 focus-visible:outline-focus"
    >
      <GoogleLogo />
      Continue with Google
    </button>
  );
}
