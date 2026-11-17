package com.epam.indigoeln.eln.common.util;

import com.epam.indigoeln.common.exception.InvalidRequestException;
import com.epam.indigoeln.common.model.search.NumericSearch;
import com.epam.indigoeln.common.model.search.StructuralSearch;
import com.epam.indigoeln.common.model.search.TextSearch;
import jakarta.enterprise.context.Dependent;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.hibernate.query.criteria.HibernateCriteriaBuilder;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

@Dependent
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CriteriaConditions {

    @Inject
    protected HibernateCriteriaBuilder cb;
    @Inject
    CriteriaFunctions functions;

    protected final List<Predicate> predicates = new ArrayList<>();

    public void add(@Nullable Predicate predicate) {
        if (predicate != null) {
            predicates.add(predicate);
        }
    }

    public void add(@Nullable Expression<Boolean> expression) {
        if (expression != null) {
            predicates.add(cb.isTrue(expression));
        }
    }

    public void textSearch(Expression<String> attribute, @Nullable TextSearch search) {
        textSearch(attribute, search, Function.identity());
    }

    public void textSearch(Expression<String> attribute, @Nullable TextSearch search, Function<String, String> valueConverter) {
        Predicate predicate = switch (search) {
            case null -> null;
            case TextSearch.WithValue w -> {
                String value = valueConverter.apply(w.value().toLowerCase());
                yield switch (w) {
                    case TextSearch.ExactSearch _ -> cb.lower(attribute).equalTo(value);
                    case TextSearch.StartsWithSearch _ -> cb.ilike(attribute, CriteriaFunctions.escapeLike(value) + '%', CriteriaFunctions.LIKE_ESCAPE);
                    case TextSearch.EndsWithSearch _ -> cb.ilike(attribute, '%' + CriteriaFunctions.escapeLike(value), CriteriaFunctions.LIKE_ESCAPE);
                    case TextSearch.ContainsSearch _ -> cb.ilike(attribute, '%' + CriteriaFunctions.escapeLike(value) + '%', CriteriaFunctions.LIKE_ESCAPE);
                };
            }
            case TextSearch.BetweenSearch b -> {
                yield cb.between(cb.lower(attribute), valueConverter.apply(b.from().toLowerCase()), valueConverter.apply(b.to().toLowerCase()));
            }
        };
        if (predicate != null) {
            predicates.add(predicate);
        }
    }

    public void numericSearch(Expression<Double> attribute, @Nullable NumericSearch search) {
        Predicate predicate = switch (search) {
            case null -> null;
            case NumericSearch.Equals e -> {
                // Equal to the precision of the search value: 78 matches [77.5, 78.5), 78.11 matches [78.105, 78.115).
                BigDecimal value = BigDecimal.valueOf(e.value());
                BigDecimal half = new BigDecimal("0.5").movePointLeft(Math.max(0, value.stripTrailingZeros().scale()));
                yield cb.and(
                        cb.greaterThanOrEqualTo(attribute, value.subtract(half).doubleValue()),
                        cb.lessThan(attribute, value.add(half).doubleValue())
                );
            }
            case NumericSearch.GreaterThanOrEqual ge -> cb.greaterThanOrEqualTo(attribute, ge.value());
            case NumericSearch.LessThanOrEqual le -> cb.lessThanOrEqualTo(attribute, le.value());
        };
        if (predicate != null) {
            predicates.add(predicate);
        }
    }

    public void fullTextSearch(Expression<SearchVector> attribute, @Nullable String search, @Nullable Expression<String> name) {
        if (search != null) {
            Predicate predicate = cb.isTrue(functions.fullTextMatch(attribute, search));
            if (name != null) {
                predicate = cb.or(predicate, functions.nameMatches(name, search));
            }
            predicates.add(predicate);
        }
    }

    public void moleculeSearch(Expression<String> attribute, @Nullable StructuralSearch search) {
        if (search != null) {
            Expression<Boolean> expression = switch (search.type()) {
                case StructuralSearch.Type.EXACT -> functions.moleculeExactMatch(attribute, search.query());
                case StructuralSearch.Type.SUBSTRUCTURE -> functions.moleculeSubstructureMatch(attribute, search.query());
                case StructuralSearch.Type.SIMILARITY -> functions.moleculeSimilarityMatch(attribute, search.query());
            };
            predicates.add(cb.isTrue(expression));
        }
    }

    public void reactionSearch(Expression<String> attribute, @Nullable StructuralSearch search) {
        if (search != null) {
            Expression<Boolean> expression = switch (search.type()) {
                case StructuralSearch.Type.EXACT -> functions.reactionExactMatch(attribute, search.query());
                case StructuralSearch.Type.SUBSTRUCTURE -> functions.reactionSubstructureMatch(attribute, search.query());
                case StructuralSearch.Type.SIMILARITY -> {
                    throw new InvalidRequestException("Reaction similarity search is not supported");
                }
            };
            predicates.add(cb.isTrue(expression));
        }
    }

    public void bool(Expression<Boolean> attribute, @Nullable Boolean search) {
        if (search != null) {
            predicates.add(search ? cb.isTrue(attribute) : cb.isFalse(attribute));
        }
    }

    public <T> void arrayContains(@Nullable T element, Expression<? extends Collection<T>> attribute) {
        if (element != null) {
            predicates.add(cb.isTrue(functions.arrayContains(element, attribute)));
        }
    }

    protected static <T extends CriteriaConditions> void doWithConditions(Instance<T> instance, Consumer<List<Predicate>> applier, Consumer<T> block) {
        T conditions = instance.get();
        try {
            block.accept(conditions);
            applier.accept(conditions.predicates);
        } finally {
            instance.destroy(conditions);
        }
    }
}
