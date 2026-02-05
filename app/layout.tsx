import "./globals.css";

export const metadata = {
  title: "Public Mood Radar for Creators",
  description:
    "Creator-focused mood and trend signals with clear provenance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
