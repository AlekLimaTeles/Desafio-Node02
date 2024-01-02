import { FastifyInstance } from "fastify";
import { ZodFirstPartyTypeKind, z } from 'zod'
import { randomUUID } from 'node:crypto'
import { knex } from '../database'

export async function mealsRoutes(app: FastifyInstance) {
    app.post(
        '/',
        async (request, reply) => {
            const createMealBodySchema = z.object({
                name: z.string(),
                description: z.string(),
                isOnDiet: z.boolean(),
                date: z.coerce.date(),
            })

            const { name, description, isOnDiet, date} = createMealBodySchema.parse(
                request.body,
            )

            await knex('meals').insert({
                id: randomUUID(),
                name,
                description,
                is_on_diet: isOnDiet,
                date: date.getTime(),
                user_id: request.user?.id,
            })

            return reply.status(201).send()
        },
    )

    app.get(
        '/',
        async (request, reply) => {
            const meals = await knex('meals')
                .where({ user_id: request.user?.id})
                .orderBy('date', 'desc')
            
                return reply.send({ meals })
        },
    )

    app.get(
        '/:mealId',
        async (request, reply) => {
            const paramsSchema = z.object({ mealId: z.string().uuid() })

            const { mealId } = paramsSchema.parse(request.params)

            const meal = await knex('meals').where({ id: mealId}).first()

            if (!meal) {
                return reply.status(404).send({ error: 'Meal not found :T'})
            }

            return reply.send({ meal })
        }
    )

    app.put(
        '/:mealId',
        async (request, reply) => {
            const paramsSchema = z.object({ mealId: z.string().uuid() })

            const { mealId } = paramsSchema.parse(request.params)

            const updateMealBodySchema = z.object({ 
                name: z.string(),
                description: z.string(),
                isOnDiet: z.boolean(),
                date: z.coerce.date(),
            })

            const { name, description, isOnDiet, date } = updateMealBodySchema.parse(
                request.body,
            )

            const meal = await knex('meals').where({ id: mealId }).first()

            if (!meal) {
                return reply.status(404).send({ error: 'Meal not found :T'})
            }

            await knex('meals').where({ id: mealId }).update({
                name,
                description,
                is_on_diet: isOnDiet,
                date: date.getTime(),
            })

            return reply.status(204).send()
        }
    )

    app.delete(
        '/:mealId',
        async (request, reply) => {
            const paramsSchema = z.object({ mealId: z.string().uuid() })

            const { mealId } = paramsSchema.parse(request.params)

            const meal = await knex('meals').where({ id: mealId}).first()

            if (!meal) {
                return reply.status(404).send({ error: 'Meal not found :T'})
            }

            await knex('meals').where({ id: mealId }).delete()

            return reply.status(204).send()
        }
    )

    app.get(
        '/metrics',
        async (request, reply) => {
            const totalMealsOnDiet = await knex('meals')
                .where({ user_id: request.user?.id, is_on_diet: true })
                .count('id', { as: 'total' })
                .first()

             const totalMealsOffDiet = await knex('meals')
                .where({user_id: request.user?.id, is_on_diet: false})
                .count('id', { as: 'total'})
                .first()   
            
            const totalMeals = await knex('meals')
                .where({ user_id: request.user?.id })
                .orderBy('date', 'desc')

            const { bestOnDietSequence } = totalMeals.reduce(
                (acc, meal) => {
                    if (meal.is_on_diet) {
                        acc.currentSequence += 1
                    } else {
                        acc.currentSequence = 0
                    }

                    if (acc.currentSequence > acc.bestOnDietSequence) {
                        acc.bestOnDietSequence = acc.currentSequence
                    }

                    return acc
                },
                { bestOnDietSequence: 0, currentSequence: 0 },
            )

            return reply.send({
                totalMeals: totalMeals.length,
                totalMealsOnDiet: totalMealsOnDiet?.total,
                totalMealsOffDiet: totalMealsOffDiet?.total,
                bestOnDietSequence,
            })     
        }
    )
}