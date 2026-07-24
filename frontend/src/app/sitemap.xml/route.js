export async function GET() {
  const urls = [
    { loc: 'https://socialapp.com/', changefreq: 'daily', priority: 1.0 },
    { loc: 'https://socialapp.com/explore', changefreq: 'daily', priority: 0.8 },
    { loc: 'https://socialapp.com/discover', changefreq: 'daily', priority: 0.8 },
  ];

  try {
    // 1. Fetch public users/profiles from backend (using suggestions as source of active public profiles)
    const usersRes = await fetch('http://127.0.0.1:8000/api/v1/users/suggestions/');
    if (usersRes.ok) {
      const users = await usersRes.json();
      users.forEach((user) => {
        urls.push({
          loc: `https://socialapp.com/${user.username}`,
          changefreq: 'weekly',
          priority: 0.7,
        });
      });
    }

    // 2. Fetch public feed posts
    const postsRes = await fetch('http://127.0.0.1:8000/api/v1/posts/feed/');
    if (postsRes.ok) {
      const feed = await postsRes.json();
      const posts = feed.results || [];
      posts.forEach((post) => {
        urls.push({
          loc: `https://socialapp.com/posts/${post.id}`,
          changefreq: 'monthly',
          priority: 0.6,
        });
      });
    }
  } catch (err) {
    console.error('Sitemap dynamic fetch failed:', err);
  }

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls
    .map(
      (url) => `
    <url>
      <loc>${url.loc}</loc>
      <changefreq>${url.changefreq}</changefreq>
      <priority>${url.priority}</priority>
    </url>`
    )
    .join('')}
</urlset>`;

  return new Response(sitemapXml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
