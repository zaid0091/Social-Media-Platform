import ProfileClient from './ProfileClient';

export async function generateMetadata({ params }) {
  const { username } = await params;
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/v1/users/profile/${username}/`);
    if (res.ok) {
      const profile = await res.json();
      const title = `${profile.full_name || profile.username} (@${profile.username}) | Social Platform`;
      const description = profile.bio || `View @${profile.username}'s profile on Social Platform.`;
      const ogImage = profile.profile_picture || null;
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          images: ogImage ? [{ url: ogImage }] : [],
        }
      };
    }
  } catch (err) {}

  return {
    title: `@${username} | Social Platform`,
  };
}

export default async function Page({ params }) {
  const { username } = await params;
  let jsonLd = null;

  try {
    const res = await fetch(`http://127.0.0.1:8000/api/v1/users/profile/${username}/`);
    if (res.ok) {
      const profile = await res.json();
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: profile.full_name || profile.username,
        alternateName: profile.username,
        description: profile.bio || '',
        image: profile.profile_picture || '',
        url: `https://socialapp.com/${profile.username}`,
      };
    }
  } catch (err) {}

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProfileClient />
    </>
  );
}
