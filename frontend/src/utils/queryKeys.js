export const userKeys = {
  all: ['users'],
  profile: (username) => [...userKeys.all, 'profile', username],
  posts: (userId) => [...userKeys.all, 'posts', userId],
};

export const postKeys = {
  all: ['posts'],
  detail: (postId) => [...postKeys.all, 'detail', postId],
  feed: (options) => [...postKeys.all, 'feed', options || {}],
};

export const storyKeys = {
  all: ['stories'],
};

export const conversationKeys = {
  all: ['conversations'],
  detail: (conversationId) => [...conversationKeys.all, 'detail', conversationId],
};

export const notificationKeys = {
  all: ['notifications'],
  unreadCount: () => [...notificationKeys.all, 'unread-count'],
};
