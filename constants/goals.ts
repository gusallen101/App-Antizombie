export type GoalCategoryKey =
  | 'espiritual'
  | 'circulocercano'
  | 'fisica'
  | 'laboral'
  | 'responsabilidad'
  | 'academico';

export type GoalCategoryDescriptor = {
  key: GoalCategoryKey;
  titleKey: `screens.goals.categories.${GoalCategoryKey}.title`;
  descriptionKey: `screens.goals.categories.${GoalCategoryKey}.description`;
  gradient: [string, string];
  accent: string;
  icon: string;
  type: number;
};

export const GOAL_CATEGORIES: GoalCategoryDescriptor[] = [
  {
    key: 'espiritual',
    titleKey: 'screens.goals.categories.espiritual.title',
    descriptionKey: 'screens.goals.categories.espiritual.description',
    gradient: ['#FBD3E9', '#BB377D'],
    accent: '#7C1C82',
    icon: 'sparkles',
    type: 1,
  },
  {
    key: 'circulocercano',
    titleKey: 'screens.goals.categories.circulocercano.title',
    descriptionKey: 'screens.goals.categories.circulocercano.description',
    gradient: ['#A1C4FD', '#C2E9FB'],
    accent: '#1161C2',
    icon: 'people-circle-outline',
    type: 2,
  },
  {
    key: 'fisica',
    titleKey: 'screens.goals.categories.fisica.title',
    descriptionKey: 'screens.goals.categories.fisica.description',
    gradient: ['#FBE0C3', '#F0C27B'],
    accent: '#B45F06',
    icon: 'fitness-outline',
    type: 3,
  },
  {
    key: 'laboral',
    titleKey: 'screens.goals.categories.laboral.title',
    descriptionKey: 'screens.goals.categories.laboral.description',
    gradient: ['#C9FFBF', '#FFAFBD'],
    accent: '#0B6E4F',
    icon: 'briefcase-outline',
    type: 4,
  },
  {
    key: 'responsabilidad',
    titleKey: 'screens.goals.categories.responsabilidad.title',
    descriptionKey: 'screens.goals.categories.responsabilidad.description',
    gradient: ['#CBBACC', '#2580B3'],
    accent: '#1D4E89',
    icon: 'earth-outline',
    type: 5,
  },
  {
    key: 'academico',
    titleKey: 'screens.goals.categories.academico.title',
    descriptionKey: 'screens.goals.categories.academico.description',
    gradient: ['#89F7FE', '#66A6FF'],
    accent: '#0E64C9',
    icon: 'school-outline',
    type: 6,
  },
];

export const GOAL_CATEGORY_TYPE: Record<GoalCategoryKey, number> = GOAL_CATEGORIES.reduce(
  (acc, category) => {
    acc[category.key] = category.type;
    return acc;
  },
  {} as Record<GoalCategoryKey, number>,
);

export const DEFAULT_GOAL_CATEGORY: GoalCategoryKey = 'espiritual';

export const GOAL_CATEGORY_KEYS = GOAL_CATEGORIES.map((category) => category.key);

export function isGoalCategoryKey(value: string | string[] | undefined): value is GoalCategoryKey {
  if (!value) {
    return false;
  }
  return GOAL_CATEGORY_KEYS.includes(value as GoalCategoryKey);
}

