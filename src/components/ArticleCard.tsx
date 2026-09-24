import { Link } from "@tanstack/react-router";

export function ArticleCard({
  a,
}: {
  a: {
    slug: string;
    type: string;
    title: string;
    excerpt: string | null;
    cover_url: string | null;
    published_at: string | null;
  };
}) {
  return (
    <Link
      to="/news/$slug"
      params={{ slug: a.slug }}
      className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/60"
    >
      {a.cover_url ? (
        <img
          src={a.cover_url}
          alt=""
          loading="lazy"
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/25 via-card to-gold/20" />
      )}
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">{a.type}</p>
        <p className="mt-1 font-serif text-lg font-bold leading-snug group-hover:underline">
          {a.title}
        </p>
        {a.excerpt && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
        )}
        {a.published_at && (
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(a.published_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </Link>
  );
}
