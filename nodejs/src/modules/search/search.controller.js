import { SearchService } from "#modules/search/search.service";
import { successResponse } from "#shared/utils/response";

export class SearchController {
  constructor(service = new SearchService()) {
    this.service = service;
  }

  global = async (req, res, next) => {
    try {
      const data = await this.service.globalSearch({
        query: req.query.q,
        limit: req.query.limit,
        user: req.auth?.user
      });

      res.status(200).json(successResponse({
        message: "Global search completed successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };
}
