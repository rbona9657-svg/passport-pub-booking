import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 text-center lg:text-left">
                <div className="mb-6 inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
                  Book your spot today
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
                  <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Passport
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Pub
                  </span>
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl max-w-lg mx-auto lg:mx-0">
                  Reserve your perfect table in seconds. Browse our floor plan,
                  pick your spot, and we'll have everything ready for you.
                </p>
                <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
                  <Link
                    href="/book"
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
                  >
                    Book a Table
                  </Link>
                  <Link
                    href="/cancel"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background px-8 text-base font-semibold transition-all hover:bg-accent"
                  >
                    Manage Bookings
                  </Link>
                </div>
                <div className="mt-4 flex sm:justify-center lg:justify-start">
                  <Link
                    href="/auth/signin"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    Admin Access
                  </Link>
                </div>
              </div>
              <div className="flex-1 max-w-md lg:max-w-lg">
                {/* Replace /hero-pub.svg with your own image by placing it in /public/ */}
                <Image
                  src="/hero-pub.svg"
                  alt="Passport Pub illustration"
                  width={500}
                  height={500}
                  className="w-full h-auto drop-shadow-2xl animate-hero-blur"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border/40 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <div className="grid gap-8 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/40 bg-card p-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Image src="/favicon.svg" alt="" width={28} height={28} />
                </div>
                <h3 className="text-lg font-semibold">Interactive Floor Plan</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  See exactly where your table is located. Pick the perfect spot for your evening.
                </p>
              </div>
              <div className="rounded-2xl border border-border/40 bg-card p-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                  <Image src="/booking-success.svg" alt="" width={28} height={28} />
                </div>
                <h3 className="text-lg font-semibold">Instant Confirmation</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Get a quick response on your booking. We'll email you as soon as it's confirmed.
                </p>
              </div>
              <div className="rounded-2xl border border-border/40 bg-card p-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                  <Image src="/no-bookings.svg" alt="" width={28} height={28} />
                </div>
                <h3 className="text-lg font-semibold">Easy Management</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Modify or cancel your booking anytime. Full control from your phone.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
