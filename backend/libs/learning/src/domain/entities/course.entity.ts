export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type LessonType = 'VIDEO' | 'TEXT';

export interface LessonView {
  id: string;
  sectionId: string;
  title: string;
  description: string | null;
  type: LessonType;
  textContent: string | null;
  sortOrder: number;
  progress?: LessonProgressView | null;
  resources?: LessonResourceView[];
}

export interface LessonResourceView {
  id: string;
  lessonId: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: string;
  createdAt: Date;
}

export interface SectionView {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: LessonView[];
}

export interface CourseView {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sections?: SectionView[];
}

export interface LessonProgressView {
  lessonId: string;
  lastPositionSeconds: number;
  maximumPositionSeconds: number;
  watchedSeconds: number;
  percentage: number;
  completedAt: Date | null;
}
