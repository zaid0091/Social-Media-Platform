import HashtagClient from './HashtagClient';

export async function generateMetadata({ params }) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  return {
    title: `#${decodedName} | Social Platform`,
    description: `Explore public posts, images, and trending topics containing #${decodedName} on Social Platform.`,
    openGraph: {
      title: `#${decodedName} on Social Platform`,
      description: `Explore public posts, images, and trending topics containing #${decodedName} on Social Platform.`,
    }
  };
}

export default async function Page() {
  return <HashtagClient />;
}
