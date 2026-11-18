// Reading a recipe from its web address (user, 2026-11-18: a butter chicken page from indianhealthyrecipes.com didn't
// read). Pages as recipe sites really write them: JSON-LD with raw line breaks, in comments or CDATA, inside a Yoast
// @graph, and pages with only the recipe card (WP Recipe Maker, Tasty Recipes, microdata).
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.DATA_DIR ||= mkdtempSync(join(tmpdir(), 'cadence-rcp-'));   // the server's config makes its folders on load
const { parseRecipe } = createRequire(import.meta.url)('../server/services/recipes.js');
const U = 'https://www.example-recipes.com/butter-chicken/';
const page = (head, body = '') => `<!doctype html><html><head><title>Butter Chicken Recipe</title><meta property="og:title" content="Butter Chicken (Chicken Makhani)"><meta property="og:image" content="https://www.example-recipes.com/bc.jpg">${head}</head><body>${body}</body></html>`;

test('JSON-LD inside a Yoast @graph, with raw tabs and line breaks in the text', () => {
  const ld = `{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},{"@type":"Recipe","name":"Butter Chicken","recipeYield":["4","4 servings"],"totalTime":"PT1H10M",
    "recipeIngredient":["500 grams chicken thighs","1 tbsp butter\tunsalted"],
    "recipeInstructions":[{"@type":"HowToSection","name":"Marinate","itemListElement":[{"@type":"HowToStep","text":"Mix the yogurt
and spices."}]},{"@type":"HowToStep","text":"Cook the chicken."}],"recipeCuisine":"Indian"}]}`;
  const r = parseRecipe(page(`<script type="application/ld+json" class="yoast-schema-graph">${ld}</script>`), U);
  expect(r).toMatchObject({ name: 'Butter Chicken', servings: 4, minutes: 70, site: 'example-recipes.com', tags: ['Indian'] });
  expect(r.ingredients).toEqual(['500 grams chicken thighs', '1 tbsp butter unsalted']);
  expect(r.steps).toEqual(['## Marinate', 'Mix the yogurt and spices.', 'Cook the chicken.']);
});

test('JSON-LD wrapped in a comment or CDATA, and without quotes on type', () => {
  const ld = '{"@type":"Recipe","name":"Dal","recipeIngredient":["1 cup lentils","2 cups water"],"recipeInstructions":"Boil.\nServe."}';
  for (const wrap of [`<!--${ld}-->`, `/*<![CDATA[*/${ld}/*]]>*/`]) {
    const r = parseRecipe(page(`<script type=application/ld+json>${wrap}</script>`), U);
    expect(r.ingredients).toEqual(['1 cup lentils', '2 cups water']); expect(r.steps).toEqual(['Boil.', 'Serve.']);
  }
});

test('no JSON-LD: the WP Recipe Maker card', () => {
  const card = `<div class="wprm-recipe"><ul class="wprm-recipe-ingredients">
    <li class="wprm-recipe-ingredient" data-uid="1"><span class="wprm-recipe-ingredient-amount">500</span> <span class="wprm-recipe-ingredient-unit">grams</span> <span class="wprm-recipe-ingredient-name">chicken</span></li>
    <li class="wprm-recipe-ingredient" data-uid="2"><span>2</span> <span>tbsp</span> <span>butter</span></li></ul>
    <ul><li class="wprm-recipe-instruction"><div class="wprm-recipe-instruction-text"><span>Marinate the chicken.</span></div></li>
    <li class="wprm-recipe-instruction"><div class="wprm-recipe-instruction-text">Make the sauce &amp; simmer.</div></li></ul></div>`;
  const r = parseRecipe(page('', card), U);
  expect(r.partial).toBeUndefined();
  expect(r.name).toBe('Butter Chicken (Chicken Makhani)');
  expect(r.ingredients).toEqual(['500 grams chicken', '2 tbsp butter']);
  expect(r.steps).toEqual(['Marinate the chicken.', 'Make the sauce & simmer.']);
});

test('no JSON-LD: schema.org microdata', () => {
  const r = parseRecipe(page('', '<div itemscope itemtype="https://schema.org/Recipe"><li itemprop="recipeIngredient">1 onion</li><li itemprop="recipeIngredient">2 tomatoes</li><li itemprop="recipeInstructions">Chop and fry.</li></div>'), U);
  expect(r.ingredients).toEqual(['1 onion', '2 tomatoes']); expect(r.steps).toEqual(['Chop and fry.']);
});

test('a page with no recipe at all still says so', () => {
  expect(parseRecipe(page(''), U)).toMatchObject({ partial: true, ingredients: [] });
});

test('recipe-scrapers reads it first, with its own scraper for indianhealthyrecipes.com', async () => {
  const { viaScrapers } = createRequire(import.meta.url)('../server/services/recipes.js');
  const ld = '{"@context":"https://schema.org","@graph":[{"@type":"Recipe","name":"Butter Chicken","author":{"@type":"Person","name":"Swasthi"},"image":["https://www.indianhealthyrecipes.com/bc.jpg"],"recipeYield":["4"],"totalTime":"PT70M","recipeIngredient":["500 grams chicken thighs","2 tbsp butter"],"recipeInstructions":[{"@type":"HowToStep","text":"Marinate the chicken."},{"@type":"HowToStep","text":"Make the sauce."}],"recipeCuisine":"Indian"}]}';
  const r = await viaScrapers(`<html lang="en"><head><script type="application/ld+json">${ld}</script></head><body></body></html>`, 'https://www.indianhealthyrecipes.com/butter-chicken/');
  expect(r).toMatchObject({ name: 'Butter Chicken', servings: 4, minutes: 70, image: 'https://www.indianhealthyrecipes.com/bc.jpg', site: 'indianhealthyrecipes.com', tags: ['Indian'] });
  expect(r.ingredients).toEqual(['500 grams chicken thighs', '2 tbsp butter']);
  expect(r.steps).toEqual(['Marinate the chicken.', 'Make the sauce.']);
  expect(await viaScrapers('<html><body>No recipe here</body></html>', 'https://example.org/x')).toBeNull();
});
