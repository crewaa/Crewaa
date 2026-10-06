export default function AuthPageLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
        <div className="bg-peacock-bg text-peacock-text">
          {children}
        </div>
    )
  }
  